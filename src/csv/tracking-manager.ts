import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { TrackingRecord, TrackingStatus } from '../types';

const TRACKING_HEADERS = [
  'email',
  'name',
  'company',
  'campaign_id',
  'status',
  'initial_sent_date',
  'last_sent_date',
  'follow_up_count',
  'next_follow_up_date',
  'last_template_used',
  'last_email_subject',
  'last_email_body',
  'error_message',
  'created_at',
  'updated_at',
];

export class TrackingManager {
  private records: Map<string, TrackingRecord> = new Map();
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    if (!fs.existsSync(this.filePath)) {
      console.log(`Tracking file not found, will create: ${this.filePath}`);
      return;
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    if (!content.trim()) {
      return;
    }

    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    for (const row of rows) {
      const record: TrackingRecord = {
        email: row.email?.toLowerCase() || '',
        name: row.name || '',
        company: row.company || '',
        campaign_id: row.campaign_id || 'default',
        status: (row.status as TrackingStatus) || 'pending',
        initial_sent_date: row.initial_sent_date || null,
        last_sent_date: row.last_sent_date || null,
        follow_up_count: parseInt(row.follow_up_count, 10) || 0,
        next_follow_up_date: row.next_follow_up_date || null,
        last_template_used: row.last_template_used || '',
        last_email_subject: row.last_email_subject || '',
        last_email_body: row.last_email_body || '',
        error_message: row.error_message || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      };

      if (record.email) {
        this.records.set(record.email, record);
      }
    }

    console.log(`Loaded ${this.records.size} tracking records from ${this.filePath}`);
  }

  getRecord(email: string): TrackingRecord | undefined {
    return this.records.get(email.toLowerCase());
  }

  hasRecord(email: string): boolean {
    return this.records.has(email.toLowerCase());
  }

  getAllRecords(): Map<string, TrackingRecord> {
    return this.records;
  }

  createRecord(
    email: string,
    name: string,
    company: string,
    campaignId: string
  ): TrackingRecord {
    const now = new Date().toISOString();
    const record: TrackingRecord = {
      email: email.toLowerCase(),
      name,
      company,
      campaign_id: campaignId,
      status: 'pending',
      initial_sent_date: null,
      last_sent_date: null,
      follow_up_count: 0,
      next_follow_up_date: null,
      last_template_used: '',
      last_email_subject: '',
      last_email_body: '',
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    this.records.set(record.email, record);
    return record;
  }

  updateRecord(email: string, updates: Partial<TrackingRecord>): TrackingRecord {
    const record = this.records.get(email.toLowerCase());
    if (!record) {
      throw new Error(`Tracking record not found for: ${email}`);
    }

    const updatedRecord: TrackingRecord = {
      ...record,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.records.set(email.toLowerCase(), updatedRecord);
    return updatedRecord;
  }

  async save(): Promise<void> {
    const records = Array.from(this.records.values());

    // Sort by created_at for consistent ordering
    records.sort((a, b) => a.created_at.localeCompare(b.created_at));

    // Escape newlines in body field for CSV
    const sanitizedRecords = records.map((record) => ({
      ...record,
      last_email_body: record.last_email_body?.replace(/\n/g, '\\n') || '',
      error_message: record.error_message || '',
    }));

    const output = stringify(sanitizedRecords, {
      header: true,
      columns: TRACKING_HEADERS,
    });

    fs.writeFileSync(this.filePath, output, 'utf-8');
    console.log(`Saved ${records.length} tracking records to ${this.filePath}`);
  }

  getRecordsDueForFollowUp(today: Date, maxFollowUps: number): TrackingRecord[] {
    const dueRecords: TrackingRecord[] = [];

    for (const record of this.records.values()) {
      if (
        record.next_follow_up_date &&
        record.follow_up_count < maxFollowUps &&
        record.status !== 'error' &&
        record.status !== 'bounced' &&
        record.status !== 'completed'
      ) {
        const followUpDate = new Date(record.next_follow_up_date);
        if (followUpDate <= today) {
          dueRecords.push(record);
        }
      }
    }

    return dueRecords;
  }
}
