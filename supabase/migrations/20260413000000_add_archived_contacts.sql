-- Create archived_contacts table (same schema as contacts + archived_at)
CREATE TABLE IF NOT EXISTS archived_contacts (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  company_name TEXT,
  is_emails_enriched BOOLEAN NOT NULL DEFAULT false,
  initial_email_subject TEXT,
  initial_email TEXT,
  follow_up_1_subject TEXT,
  follow_up_1 TEXT,
  follow_up_2_subject TEXT,
  follow_up_2 TEXT,
  follow_up_3_subject TEXT,
  follow_up_3 TEXT,
  research_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop FK constraint on email_tracking so tracking records are preserved
-- when contacts are moved to the archive table
ALTER TABLE email_tracking DROP CONSTRAINT IF EXISTS email_tracking_email_fkey;
