import { Config, RunResult, TrackingStatus } from '../types';
import { loadConfig } from '../config';
import { parseContacts } from '../csv/contact-parser';
import { TrackingManager } from '../csv/tracking-manager';
import { GmailAuthClient } from '../auth/gmail-auth';
import { GmailSender } from '../email/gmail-sender';
import { TemplateEngine } from '../email/template-engine';
import { RateLimiter } from '../email/rate-limiter';
import { CampaignScheduler } from './scheduler';

export class CampaignRunner {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async run(): Promise<RunResult> {
    const result: RunResult = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    console.log('\n=== Cold Email Campaign ===');
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Daily Limit: ${this.config.campaign.dailyLimit}`);
    console.log(`Follow-up Intervals: ${this.config.campaign.followUpIntervals.join(', ')} days`);
    console.log('');

    // 1. Load contacts
    console.log('Loading contacts...');
    const contacts = await parseContacts(this.config.paths.contactsCsv);

    // 2. Load tracking
    console.log('Loading tracking data...');
    const trackingManager = new TrackingManager(this.config.paths.trackingCsv);
    await trackingManager.load();

    // 3. Load templates
    console.log('Loading email templates...');
    const templateEngine = new TemplateEngine();
    await templateEngine.loadTemplates(this.config.paths.templatesDir);

    // 4. Initialize Gmail (skip in dry run)
    let sender: GmailSender | null = null;
    if (!this.config.dryRun) {
      console.log('Initializing Gmail client...');
      const authClient = new GmailAuthClient(this.config.gmail);
      const gmail = await authClient.getGmailClient();
      sender = new GmailSender(gmail, this.config.gmail.senderEmail);
    }

    // 5. Get emails to send today
    console.log('\nScheduling emails...');
    const scheduler = new CampaignScheduler(this.config, trackingManager, contacts);
    const tasks = scheduler.getEmailsToSend(new Date());

    if (tasks.length === 0) {
      console.log('\nNo emails to send today.');
      return result;
    }

    // 6. Send emails with rate limiting
    console.log('\nSending emails...\n');
    const rateLimiter = new RateLimiter(this.config.campaign.dailyLimit);

    for (const task of tasks) {
      if (!rateLimiter.canSend()) {
        console.log('Daily limit reached, stopping.');
        break;
      }

      // Check if template exists
      if (!templateEngine.hasTemplate(task.templateName)) {
        console.log(`  [SKIP] ${task.contact.email} - Template not found: ${task.templateName}`);
        result.skipped++;
        continue;
      }

      // Render email
      const rendered = templateEngine.render(task.templateName, task.contact);

      // Ensure tracking record exists
      let record = task.record;
      if (!record) {
        record = trackingManager.createRecord(
          task.contact.email,
          task.contact.name,
          task.contact.company || '',
          this.config.campaign.campaignId
        );
      }

      if (this.config.dryRun) {
        // Dry run - just log what would be sent
        console.log(`  [DRY] ${task.contact.email}`);
        console.log(`        Subject: ${rendered.subject}`);
        console.log(`        Template: ${task.templateName} (${task.type})`);

        // Still update tracking in dry run mode
        const newFollowUpCount = task.type === 'follow_up' ? record.follow_up_count + 1 : 0;
        const status: TrackingStatus = newFollowUpCount >= this.config.campaign.maxFollowUps
          ? 'completed'
          : 'sent';

        trackingManager.updateRecord(task.contact.email, {
          status,
          initial_sent_date: record.initial_sent_date || new Date().toISOString(),
          last_sent_date: new Date().toISOString(),
          follow_up_count: newFollowUpCount,
          next_follow_up_date: scheduler.calculateNextFollowUpDate(newFollowUpCount),
          last_template_used: task.templateName,
          last_email_subject: rendered.subject,
          last_email_body: rendered.body,
        });

        result.sent++;
      } else {
        // Live mode - actually send
        console.log(`  [SEND] ${task.contact.email} - ${task.templateName}`);

        const sendResult = await sender!.sendEmail(
          task.contact.email,
          rendered.subject,
          rendered.body
        );

        if (sendResult.success) {
          const newFollowUpCount = task.type === 'follow_up' ? record.follow_up_count + 1 : 0;
          const status: TrackingStatus = newFollowUpCount >= this.config.campaign.maxFollowUps
            ? 'completed'
            : 'sent';

          trackingManager.updateRecord(task.contact.email, {
            status,
            initial_sent_date: record.initial_sent_date || new Date().toISOString(),
            last_sent_date: new Date().toISOString(),
            follow_up_count: newFollowUpCount,
            next_follow_up_date: scheduler.calculateNextFollowUpDate(newFollowUpCount),
            last_template_used: task.templateName,
            last_email_subject: rendered.subject,
            last_email_body: rendered.body,
            error_message: null,
          });

          result.sent++;
          console.log(`         ✓ Sent (ID: ${sendResult.messageId})`);
        } else {
          trackingManager.updateRecord(task.contact.email, {
            status: 'error',
            error_message: sendResult.error || 'Unknown error',
          });

          result.failed++;
          result.errors.push(`${task.contact.email}: ${sendResult.error}`);
          console.log(`         ✗ Failed: ${sendResult.error}`);
        }

        // Wait before next email
        await rateLimiter.waitForNextSlot();
      }

      rateLimiter.recordSent();
    }

    // 7. Save tracking
    console.log('\nSaving tracking data...');
    await trackingManager.save();

    // 8. Print summary
    console.log('\n=== Summary ===');
    console.log(`Sent: ${result.sent}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Skipped: ${result.skipped}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
    }

    return result;
  }
}

// CLI entry point
export async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');

  try {
    const config = loadConfig(isDryRun);
    const runner = new CampaignRunner(config);
    const result = await runner.run();

    // Exit with error code if there were failures
    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}
