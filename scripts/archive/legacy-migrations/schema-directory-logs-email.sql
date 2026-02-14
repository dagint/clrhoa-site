-- Add email to directory_logs for audit when users reveal email in directory.
-- npm run db:directory-logs-email:local or db:directory-logs-email (remote)
-- Audit data: retention and access should follow FL law and association policy. See docs/DIRECTORY_LOGS_AUDIT.md.

ALTER TABLE directory_logs ADD COLUMN target_email TEXT;
