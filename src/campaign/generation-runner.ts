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
  private delayMs: number;
  private dailyLimit: number;

  constructor(options: {
    promptsDir: string;
    senderInfo: SenderInfo;
    timeoutMs?: number;
    delayMs?: number;
    dailyLimit?: number;
  }) {
    this.claudeCli = new ClaudeCli({ timeoutMs: options.timeoutMs || 120000 });
    this.promptBuilder = new PromptBuilder(options.promptsDir, options.senderInfo);
    this.emailParser = new EmailParser();
    this.delayMs = options.delayMs || 5000;
    this.dailyLimit = options.dailyLimit || 20;
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
    console.log(`Delay between generations: ${this.delayMs}ms\n`);

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

    // 3. Generate emails for each contact
    for (let i = 0; i < limitedContacts.length; i++) {
      const contact = limitedContacts[i];

      console.log(`\n[${i + 1}/${limitedContacts.length}] ${contact.email}`);
      console.log(`  Name: ${contact.name}`);
      console.log(`  Company: ${contact.company_name || 'N/A'}`);

      try {
        await this.generateForContact(contact);
        result.generated++;
        console.log('  [OK] All 4 emails generated and saved');
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`${contact.email}: ${errorMsg}`);
        console.error(`  [ERROR] ${errorMsg}`);
      }

      // Rate limit between generations
      if (i < limitedContacts.length - 1) {
        console.log(`  Waiting ${this.delayMs}ms...`);
        await this.sleep(this.delayMs);
      }
    }

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI entry point
export async function main(): Promise<void> {
  console.log('Starting email generation...\n');

  // Load configuration
  const config = loadConfig(true); // dry-run mode for generation (no Gmail needed)
  const projectRoot = process.cwd();

  // Get sender info from environment
  const senderInfo: SenderInfo = {
    name: process.env.SENDER_NAME || 'Your Name',
    company: process.env.SENDER_COMPANY || 'Your Company',
    role: process.env.SENDER_ROLE || 'Founder',
    valueProposition: process.env.VALUE_PROPOSITION || 'We help companies succeed',
  };

  console.log('Sender Info:');
  console.log(`  Name: ${senderInfo.name}`);
  console.log(`  Company: ${senderInfo.company}`);
  console.log(`  Role: ${senderInfo.role}`);
  console.log(`  Value Prop: ${senderInfo.valueProposition}`);

  const runner = new GenerationRunner({
    promptsDir: process.env.PROMPTS_DIR || path.join(projectRoot, 'data', 'prompts'),
    senderInfo,
    timeoutMs: parseInt(process.env.CLAUDE_TIMEOUT_MS || '120000', 10),
    delayMs: parseInt(process.env.GENERATION_DELAY_MS || '5000', 10),
    dailyLimit: parseInt(process.env.GENERATION_DAILY_LIMIT || '20', 10),
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
