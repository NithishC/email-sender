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
    this.concurrency = options.concurrency || 2;
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

    // 3. Group contacts by company for batched generation
    const groups = this.groupByCompany(limitedContacts);
    console.log(`Grouped into ${groups.length} company batches\n`);

    const parallelResult = await this.processInParallel(
      groups,
      async (group, index, total) => {
        const company = group[0].company_name || 'Unknown';
        console.log(`\n[Batch ${index + 1}/${total}] ${company} (${group.length} contact${group.length > 1 ? 's' : ''})`);
        group.forEach(c => console.log(`  - ${c.name} <${c.email}>`));

        if (group.length === 1) {
          await this.generateForContact(group[0]);
          console.log(`  [OK] Emails generated for ${group[0].name}`);
        } else {
          await this.generateForBatch(group);
          console.log(`  [OK] Emails generated for all ${group.length} contacts`);
        }
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

  private groupByCompany(contacts: Contact[]): Contact[][] {
    const map = new Map<string, Contact[]>();
    for (const contact of contacts) {
      const key = contact.company_name || contact.email;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(contact);
    }
    return Array.from(map.values());
  }

  private async generateForBatch(contacts: Contact[]): Promise<void> {
    const prompt = this.promptBuilder.buildBatchSequencePrompt(contacts);

    console.log('  Calling Claude CLI with web search...');

    const cliResult = await this.claudeCli.execute(prompt, { allowWebSearch: true });

    if (!cliResult.success) {
      throw new Error(`Claude CLI: ${cliResult.error}`);
    }

    console.log(`  Response received (${cliResult.durationMs}ms)`);

    const results = this.emailParser.parseBatchSequence(cliResult.output, contacts.length);

    for (let i = 0; i < contacts.length; i++) {
      const emails = results[i];
      if (!emails) {
        throw new Error(`Failed to parse emails for ${contacts[i].name}`);
      }
      console.log(`  Saving emails for ${contacts[i].name}...`);
      await updateContactEmails(contacts[i].email, emails);
    }
  }

  private async processInParallel<T>(
    items: T[],
    processor: (item: T, index: number, total: number) => Promise<void>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    let currentIndex = 0;
    const total = items.length;

    const workers = Array(Math.min(this.concurrency, items.length))
      .fill(null)
      .map(async () => {
        while (currentIndex < items.length) {
          const index = currentIndex++;
          const item = items[index];
          try {
            await processor(item, index, total);
            result.success++;
          } catch (error) {
            result.failed++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            const label = Array.isArray(item)
              ? (item as Contact[])[0].company_name || (item as Contact[])[0].email
              : (item as Contact).email;
            result.errors.push(`${label}: ${errorMsg}`);
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
- Architected distributed parallel system (ECS Fargate + SQS + Lambda) on Linux serving 20+ B2B clients with 200+ concurrent workers, reducing 
runtime by 65% (12-14 hrs to 4-5 hrs for 1,000+ prospects)
- Cut per-job LLM inference cost from $25 to $15-20 per 200-prospect batch by diagnosing a prompt-caching misconfiguration and switching to 
Claude-as-orchestrator + GPT-mini execution model, maintaining output quality
- Shipped end-to-end AI agentic system orchestrating multi-LLM pipelines (Claude, GPT-5, O3 Deep Research) with production-grade resilience 
patterns (tool calling, retries, timeouts, circuit breakers), deployed in one week
- Developed NLP and RAG pipelines processing thousands of meeting transcripts, recordings and web sources into structured business insights, 
automating campaign document generation 90% faster for clients
- Identified API rate-limiting constraints through hands-on load testing, benchmarking tokens per call and requests per minute, then proposed and 
implemented a retry queue with dead-letter queue (DLQ), enabling failure diagnosis and zero-loss recovery for previously unrecoverable jobs

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
    timeoutMs: parseInt(process.env.CLAUDE_TIMEOUT_MS || '300000', 10),
    dailyLimit: parseInt(process.env.GENERATION_DAILY_LIMIT || '20', 10),
    concurrency: parseInt(process.env.GENERATION_CONCURRENCY || '2', 10),
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
