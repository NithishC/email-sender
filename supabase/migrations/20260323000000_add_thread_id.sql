-- Add Gmail thread tracking columns to email_tracking
ALTER TABLE email_tracking
  ADD COLUMN IF NOT EXISTS thread_id TEXT,
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
