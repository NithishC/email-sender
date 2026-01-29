import * as path from 'path';
import { loadConfig } from '../config';
import { getUnenrichedContacts, updateContactEmails } from '../db/contacts';
import { ClaudeCli } from '../ai/claude-cli';
import { PromptBuilder, SenderInfo } from '../ai/prompt-builder';
import { EmailParser } from '../ai/email-parser';
import { Contact, GenerationResult } from '../types';

export class GenerationRunner {
  private claudeCli: ClaudeCli;
  private promptBuilder: PromptBuilder;
  private emailParser: EmailParser;
  private dailyLimit: number;
  private concurrency: number;

  constructor(options: {
    promptsDir: string;
    senderInfo: SenderInfo;
    timeoutMs?: number;
    dailyLimit?: number;
    concurrency?: number;
  }) {
    this.claudeCli = new ClaudeCli({ timeoutMs: options.timeoutMs || 120000 });
    this.promptBuilder = new PromptBuilder(options.promptsDir, options.senderInfo);
    this.emailParser = new EmailParser();
    this.dailyLimit = options.dailyLimit || 20;
    this.concurrency = options.concurrency || 5;
  }

  async run(): Promise<GenerationResult> {
    const result: GenerationResult = {
      generated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    console.log('\n=== Email Generation (Claude CLI) ===');
    console.log(`Daily Limit: ${this.dailyLimit}`);
    console.log(`Concurrency: ${this.concurrency} parallel workers\n`);

    // 1. Load unenriched contacts
    console.log('Loading unenriched contacts from Supabase...');
    const contacts = await getUnenrichedContacts();
    console.log(`Found ${contacts.length} contacts needing email generation`);

    if (contacts.length === 0) {
      console.log('No contacts to process.');
      return result;
    }

    // 2. Limit contacts
    const limitedContacts = contacts.slice(0, this.dailyLimit);
    if (contacts.length > this.dailyLimit) {
      console.log(`Limiting to ${this.dailyLimit} (${contacts.length - this.dailyLimit} deferred)`);
    }

    // 3. Generate emails for each contact in parallel
    const parallelResult = await this.processInParallel(
      limitedContacts,
      async (contact, index, total) => {
        console.log(`\n[${index + 1}/${total}] ${contact.email}`);
        console.log(`  Name: ${contact.name}`);
        console.log(`  Company: ${contact.company_name || 'N/A'}`);

        await this.generateForContact(contact);
        console.log(`  [OK] All 4 emails generated and saved`);
      }
    );

    result.generated = parallelResult.success;
    result.failed = parallelResult.failed;
    result.errors = parallelResult.errors;

    // 4. Summary
    console.log('\n=== Generation Summary ===');
    console.log(`Generated: ${result.generated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }

    return result;
  }

  private async generateForContact(contact: Contact): Promise<void> {
    // Build prompt for full email sequence
    const prompt = this.promptBuilder.buildFullSequencePrompt(contact);

    console.log('  Calling Claude CLI with web search...');

    // Call Claude CLI with web search enabled
    const cliResult = await this.claudeCli.execute(prompt, {
      allowWebSearch: true,
    });

    if (!cliResult.success) {
      throw new Error(`Claude CLI: ${cliResult.error}`);
    }

    console.log(`  Response received (${cliResult.durationMs}ms)`);

    // Parse the output for all 4 emails
    const emails = this.emailParser.parseFullSequence(cliResult.output);

    if (!emails) {
      throw new Error('Failed to parse Claude output');
    }

    // Save to contacts table
    console.log('  Saving emails to contacts table...');
    await updateContactEmails(contact.email, emails);
  }

  private async processInParallel(
    contacts: Contact[],
    processor: (contact: Contact, index: number, total: number) => Promise<void>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    let currentIndex = 0;
    const total = contacts.length;

    const workers = Array(Math.min(this.concurrency, contacts.length))
      .fill(null)
      .map(async () => {
        while (currentIndex < contacts.length) {
          const index = currentIndex++;
          const contact = contacts[index];
          try {
            await processor(contact, index, total);
            result.success++;
          } catch (error) {
            result.failed++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`${contact.email}: ${errorMsg}`);
            console.error(`  [ERROR] ${errorMsg}`);
          }
        }
      });

    await Promise.all(workers);
    return result;
  }
}

// CLI entry point
export async function main(): Promise<void> {
  console.log('Starting email generation...\n');

  // Load configuration
  const config = loadConfig(true); // dry-run mode for generation (no Gmail needed)
  const projectRoot = process.cwd();

  // Nithish's background - ALL REAL METRICS from resume
  const senderInfo: SenderInfo = {
    name: 'SENDER_NAME',
    email: 'SENDER_EMAIL',
    linkedin: 'SENDER_LINKEDIN',
    github: 'SENDER_GITHUB',
    currentRole: 'SENDER_ROLE',
    background: `
## Current Role - YourCompany (Aug 2025 - Present)
- Scaled AI enrichment pipeline from 12-14 hours to 4-5 hours for 1000+ rows using ECS Fargate + SQS + Lambda with 200+ parallel executors
- Shipped end-to-end AI agentic system in one week, orchestrating multi-LLM (Claude, GPT-5, O3 Deep Research) with RAG pipelines
- Built robust agent patterns: tooling, retries, timeouts, circuit breakers for production-grade reliability
- Delivered AI-powered Business Intelligence systems for meeting analysis, campaign document automation (90% faster)
- Built large-scale pipelines processing thousands of meeting transcripts with LinkedIn and web intelligence

## Previous Role - PreviousCompany (Jun 2022 - Aug 2023)
- Led React modernization reducing page load time from 4.2s to 2.1s (50% improvement) and bounce rate by 35%
- Spearheaded migration of 1000+ lines of code, achieving 40% reduction in infrastructure costs
- Created Flask microservices supporting $4M in total loan originations, decreasing document processing latency by 68%
- Implemented Redis caching for credit assessment platform, reducing PostgreSQL load by 42%
- Designed automated CI/CD pipeline achieving zero-downtime deployments and reducing QA cycles by 75%
- Optimized Spring Boot APIs, improving transaction latency by 35%
- Reduced system downtime by 30% through effective incident resolution

## Education & Skills
- MS in Software Engineering from Northeastern University (GPA 3.7)
- Tech stack: Python, TypeScript, React, Node.js, AWS (ECS, Lambda, SQS, S3, RDS), Docker, Kubernetes, PostgreSQL, Redis, MongoDB, LangChain, RAG, OpenAI API
    `.trim(),
  };

  console.log('Sender Info:');
  console.log(`  Name: ${senderInfo.name}`);
  console.log(`  Current Role: ${senderInfo.currentRole}`);

  const runner = new GenerationRunner({
    promptsDir: process.env.PROMPTS_DIR || path.join(projectRoot, 'data', 'prompts'),
    senderInfo,
    timeoutMs: parseInt(process.env.CLAUDE_TIMEOUT_MS || '120000', 10),
    dailyLimit: parseInt(process.env.GENERATION_DAILY_LIMIT || '20', 10),
    concurrency: parseInt(process.env.GENERATION_CONCURRENCY || '5', 10),
  });

  try {
    const result = await runner.run();

    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
