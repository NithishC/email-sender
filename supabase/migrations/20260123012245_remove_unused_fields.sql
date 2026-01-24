-- Remove unused fields from contacts table
ALTER TABLE contacts DROP COLUMN IF EXISTS industry;
ALTER TABLE contacts DROP COLUMN IF EXISTS custom_fields;
ALTER TABLE contacts DROP COLUMN IF EXISTS active;

-- Drop indexes that reference active
DROP INDEX IF EXISTS idx_contacts_unenriched;
DROP INDEX IF EXISTS idx_contacts_enriched;

-- Recreate indexes without active filter
CREATE INDEX idx_contacts_unenriched
  ON contacts(is_emails_enriched, created_at)
  WHERE is_emails_enriched = false;

CREATE INDEX idx_contacts_enriched
  ON contacts(is_emails_enriched)
  WHERE is_emails_enriched = true;
