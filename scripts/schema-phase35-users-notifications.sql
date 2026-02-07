-- Phase 3.5: User notification preferences (SMS opt-in).
-- Run: npm run db:phase35:local or db:phase35 (remote)

-- Add columns if not present (idempotent)
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN sms_optin INTEGER DEFAULT 0;
