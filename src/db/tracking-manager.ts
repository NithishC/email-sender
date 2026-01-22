import { getSupabaseClient } from './supabase';
import { TrackingRecord, TrackingStatus } from '../types';

interface SupabaseTrackingRecord {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  campaign_id: string;
  status: string;
  initial_sent_date: string | null;
  last_sent_date: string | null;
  follow_up_count: number;
  next_follow_up_date: string | null;
  last_template_used: string | null;
  last_email_subject: string | null;
  last_email_body: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function toTrackingRecord(row: SupabaseTrackingRecord): TrackingRecord {
  return {
    email: row.email.toLowerCase(),
    name: row.name || '',
    company: row.company || '',
    campaign_id: row.campaign_id,
    status: row.status as TrackingStatus,
    initial_sent_date: row.initial_sent_date,
    last_sent_date: row.last_sent_date,
    follow_up_count: row.follow_up_count,
    next_follow_up_date: row.next_follow_up_date,
    last_template_used: row.last_template_used || '',
    last_email_subject: row.last_email_subject || '',
    last_email_body: row.last_email_body || '',
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class TrackingManager {
  private records: Map<string, TrackingRecord> = new Map();

  async load(): Promise<void> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('email_tracking')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load tracking records: ${error.message}`);
    }

    this.records.clear();

    if (data) {
      for (const row of data as SupabaseTrackingRecord[]) {
        const record = toTrackingRecord(row);
        this.records.set(record.email, record);
      }
    }

    console.log(`Loaded ${this.records.size} tracking records from Supabase`);
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

  async createRecord(
    email: string,
    name: string,
    company: string,
    campaignId: string
  ): Promise<TrackingRecord> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const newRecord = {
      email: email.toLowerCase(),
      name,
      company,
      campaign_id: campaignId,
      status: 'pending',
      follow_up_count: 0,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('email_tracking')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create tracking record: ${error.message}`);
    }

    const record = toTrackingRecord(data as SupabaseTrackingRecord);
    this.records.set(record.email, record);
    return record;
  }

  async updateRecord(email: string, updates: Partial<TrackingRecord>): Promise<TrackingRecord> {
    const supabase = getSupabaseClient();
    const normalizedEmail = email.toLowerCase();

    const record = this.records.get(normalizedEmail);
    if (!record) {
      throw new Error(`Tracking record not found for: ${email}`);
    }

    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('email_tracking')
      .update(updateData)
      .eq('email', normalizedEmail)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update tracking record: ${error.message}`);
    }

    const updatedRecord = toTrackingRecord(data as SupabaseTrackingRecord);
    this.records.set(normalizedEmail, updatedRecord);
    return updatedRecord;
  }

  getRecordsDueForFollowUp(today: Date, maxFollowUps: number): TrackingRecord[] {
    const dueRecords: TrackingRecord[] = [];
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    for (const record of this.records.values()) {
      if (
        record.next_follow_up_date &&
        record.follow_up_count < maxFollowUps &&
        record.status !== 'error' &&
        record.status !== 'bounced' &&
        record.status !== 'completed'
      ) {
        // Compare dates (YYYY-MM-DD format)
        if (record.next_follow_up_date <= todayStr) {
          dueRecords.push(record);
        }
      }
    }

    return dueRecords;
  }

  // No-op for Supabase - changes are persisted immediately
  async save(): Promise<void> {
    // Records are saved directly to Supabase on create/update
    console.log('Tracking data persisted to Supabase');
  }
}
