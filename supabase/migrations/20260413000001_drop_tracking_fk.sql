-- Drop the FK constraint so email_tracking records are preserved
-- when contacts are moved to archived_contacts
ALTER TABLE email_tracking DROP CONSTRAINT IF EXISTS fk_tracking_contact;
