import { Contact, EmailTask, Config } from '../types';
import { TrackingManager } from '../db/tracking-manager';

export class CampaignScheduler {
  private config: Config;
  private trackingManager: TrackingManager;
  private contacts: Contact[];

  constructor(config: Config, trackingManager: TrackingManager, contacts: Contact[]) {
    this.config = config;
    this.trackingManager = trackingManager;
    this.contacts = contacts;
  }

  getEmailsToSend(today: Date): EmailTask[] {
    const tasks: EmailTask[] = [];

    // Priority 1: Follow-ups due today
    const dueFollowUps = this.trackingManager.getRecordsDueForFollowUp(
      today,
      this.config.campaign.maxFollowUps
    );

    for (const record of dueFollowUps) {
      const contact = this.findContact(record.email);
      if (!contact) {
        console.warn(`Contact not found for follow-up: ${record.email}`);
        continue;
      }

      const followUpNumber = record.follow_up_count + 1;
      const templateName = `followup-${followUpNumber}`;

      tasks.push({
        type: 'follow_up',
        contact,
        record,
        templateName,
      });
    }

    // Priority 2: New contacts not yet emailed
    for (const contact of this.contacts) {
      if (!this.trackingManager.hasRecord(contact.email)) {
        tasks.push({
          type: 'initial',
          contact,
          record: null,
          templateName: 'initial',
        });
      }
    }

    // Enforce daily limit
    const limitedTasks = tasks.slice(0, this.config.campaign.dailyLimit);

    console.log(`Scheduled ${limitedTasks.length} emails to send:`);
    console.log(`  - Follow-ups: ${limitedTasks.filter((t) => t.type === 'follow_up').length}`);
    console.log(`  - Initial: ${limitedTasks.filter((t) => t.type === 'initial').length}`);

    return limitedTasks;
  }

  private findContact(email: string): Contact | undefined {
    return this.contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());
  }

  calculateNextFollowUpDate(currentFollowUpCount: number): string | null {
    const intervals = this.config.campaign.followUpIntervals;

    if (currentFollowUpCount >= this.config.campaign.maxFollowUps) {
      return null; // No more follow-ups
    }

    // Get the interval for the next follow-up
    const intervalIndex = currentFollowUpCount;
    if (intervalIndex >= intervals.length) {
      return null; // No more intervals defined
    }

    const daysUntilNextFollowUp = intervals[intervalIndex];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysUntilNextFollowUp);

    return nextDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
}
