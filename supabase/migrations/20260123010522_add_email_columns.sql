-- Add email storage columns to contacts table
-- This enables storing generated emails directly in the contacts table

-- Add is_emails_enriched flag (false = needs generation)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_emails_enriched BOOLEAN DEFAULT false;

-- Add email content columns (initial + 3 follow-ups)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS initial_email_subject TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS initial_email TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_1_subject TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_1 TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_2_subject TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_2 TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_3_subject TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_3 TEXT;

-- Add research summary column
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS research_summary TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_unenriched
  ON contacts(is_emails_enriched, active, created_at)
  WHERE is_emails_enriched = false AND active = true;

CREATE INDEX IF NOT EXISTS idx_contacts_enriched
  ON contacts(is_emails_enriched, active)
  WHERE is_emails_enriched = true AND active = true;

CREATE INDEX IF NOT EXISTS idx_email_tracking_followup
  ON email_tracking(next_follow_up_date)
  WHERE next_follow_up_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_tracking_status
  ON email_tracking(status);

-- Drop old email_drafts table if exists
DROP TABLE IF EXISTS email_drafts;
