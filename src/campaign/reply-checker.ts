import { loadConfig } from '../config';
import { GmailAuthClient } from '../auth/gmail-auth';
import { TrackingManager } from '../db/tracking-manager';
import { gmail_v1 } from 'googleapis';

interface ReplyCheckResult {
  checked: number;
  repliesFound: number;
  errors: string[];
}

export class ReplyChecker {
  private config: ReturnType<typeof loadConfig>;
  private gmail: gmail_v1.Gmail | null = null;

  constructor(config: ReturnType<typeof loadConfig>) {
    this.config = config;
  }

  async run(): Promise<ReplyCheckResult> {
    const result: ReplyCheckResult = {
      checked: 0,
      repliesFound: 0,
      errors: [],
    };

    console.log('\n=== Reply Checker ===');
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);

    // 1. Initialize Gmail client
    console.log('\nInitializing Gmail client...');
    const authClient = new GmailAuthClient(this.config.gmail);
    this.gmail = await authClient.getGmailClient();

    // 2. Load tracking data
    console.log('Loading tracking data...');
    const trackingManager = new TrackingManager();
    await trackingManager.load();

    // 3. Get active contacts (those we're still sending follow-ups to)
    const activeStatuses = ['sent', 'follow_up_1', 'follow_up_2', 'follow_up_3'];
    const activeRecords = Array.from(trackingManager.getAllRecords().values())
      .filter(r => activeStatuses.includes(r.status));

    if (activeRecords.length === 0) {
      console.log('No active contacts to check for replies.');
      return result;
    }

    console.log(`\nChecking ${activeRecords.length} active contacts for replies...`);

    // 4. Check each contact for replies
    for (const record of activeRecords) {
      result.checked++;

      try {
        const hasReply = await this.checkForReply(record.email, record.initial_sent_date);

        if (hasReply) {
          console.log(`  [REPLY] ${record.email}`);

          if (!this.config.dryRun) {
            await trackingManager.updateRecord(record.email, {
              status: 'replied',
            });
          }

          result.repliesFound++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  [ERROR] ${record.email}: ${errorMsg}`);
        result.errors.push(`${record.email}: ${errorMsg}`);
      }

      // Small delay to avoid rate limiting
      await this.sleep(100);
    }

    // 5. Summary
    console.log('\n=== Reply Check Summary ===');
    console.log(`Checked: ${result.checked}`);
    console.log(`Replies found: ${result.repliesFound}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.repliesFound > 0 && this.config.dryRun) {
      console.log('\n[DRY RUN] Would have marked these contacts as replied');
    }

    return result;
  }

  private async checkForReply(contactEmail: string, sentAfter: string | null): Promise<boolean> {
    if (!this.gmail) {
      throw new Error('Gmail client not initialized');
    }

    // Build search query: emails FROM the contact, after we sent our first email
    let query = `from:${contactEmail}`;

    if (sentAfter) {
      // Convert ISO date to Gmail query format (YYYY/MM/DD)
      const date = new Date(sentAfter);
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      query += ` after:${dateStr}`;
    }

    // Search inbox
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 1, // We only need to know if at least one exists
    });

    const messages = response.data.messages || [];
    return messages.length > 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI entry point
export async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('Starting reply checker...\n');

  try {
    const config = loadConfig(isDryRun);
    const checker = new ReplyChecker(config);
    const result = await checker.run();

    if (result.errors.length > 0) {
      console.log('\nErrors encountered:');
      result.errors.forEach(e => console.log(`  - ${e}`));
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
