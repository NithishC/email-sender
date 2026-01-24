-- Migration: Change contacts to use email as primary key
-- This removes the id column and makes email the PK

-- Step 1: Drop existing primary key constraint and id column from contacts
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_pkey;
ALTER TABLE contacts DROP COLUMN IF EXISTS id;

-- Step 2: Add email as primary key
ALTER TABLE contacts ADD PRIMARY KEY (email);

-- Step 3: Rename company to company_name if needed
ALTER TABLE contacts RENAME COLUMN company TO company_name;

-- Step 4: Update email_tracking - drop id, make email the PK with FK
ALTER TABLE email_tracking DROP CONSTRAINT IF EXISTS email_tracking_pkey;
ALTER TABLE email_tracking DROP COLUMN IF EXISTS id;

-- Drop old columns we don't need
ALTER TABLE email_tracking DROP COLUMN IF EXISTS name;
ALTER TABLE email_tracking DROP COLUMN IF EXISTS company;
ALTER TABLE email_tracking DROP COLUMN IF EXISTS last_template_used;
ALTER TABLE email_tracking DROP COLUMN IF EXISTS last_email_subject;
ALTER TABLE email_tracking DROP COLUMN IF EXISTS last_email_body;

-- Make email the primary key with FK reference
ALTER TABLE email_tracking ADD PRIMARY KEY (email);
ALTER TABLE email_tracking ADD CONSTRAINT fk_tracking_contact
  FOREIGN KEY (email) REFERENCES contacts(email) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_unenriched
  ON contacts(is_emails_enriched, active, created_at)
  WHERE is_emails_enriched = false AND active = true;

CREATE INDEX IF NOT EXISTS idx_contacts_enriched
  ON contacts(is_emails_enriched, active)
  WHERE is_emails_enriched = true AND active = true;
