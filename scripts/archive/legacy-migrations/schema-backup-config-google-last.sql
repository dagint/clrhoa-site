-- Add last Google Drive backup timestamp (set by backup Worker after successful Drive upload).
-- Run: npm run db:backup-config-google-last (remote) or db:backup-config-google-last:local
ALTER TABLE backup_config ADD COLUMN last_google_backup_at TEXT;
