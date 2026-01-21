// Contact from input CSV
export interface Contact {
  email: string;
  name: string;
  company: string;
  [key: string]: string; // Allow dynamic custom fields
}

// Tracking record for each contact
export interface TrackingRecord {
  email: string;
  name: string;
  company: string;
  campaign_id: string;
  status: TrackingStatus;
  initial_sent_date: string | null;
  last_sent_date: string | null;
  follow_up_count: number;
  next_follow_up_date: string | null;
  last_template_used: string;
  last_email_subject: string;
  last_email_body: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type TrackingStatus =
  | 'pending'
  | 'sent'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'completed'
  | 'error'
  | 'bounced';

// Parsed email template
export interface ParsedTemplate {
  name: string;
  subject: string;
  body: string;
}

// Rendered email ready to send
export interface RenderedEmail {
  subject: string;
  body: string;
}

// Email task to be processed
export interface EmailTask {
  type: 'initial' | 'follow_up';
  contact: Contact;
  record: TrackingRecord | null;
  templateName: string;
}

// Result of sending an email
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Campaign run result
export interface RunResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// Application configuration
export interface Config {
  gmail: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    senderEmail: string;
  };
  campaign: {
    dailyLimit: number;
    followUpIntervals: number[];
    maxFollowUps: number;
    campaignId: string;
  };
  paths: {
    contactsCsv: string;
    trackingCsv: string;
    templatesDir: string;
  };
  dryRun: boolean;
}
