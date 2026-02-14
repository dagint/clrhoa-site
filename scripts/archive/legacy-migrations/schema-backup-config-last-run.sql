-- Add last R2 backup timestamp (set by backup Worker after each successful run).
-- Run: npm run db:backup-config-last-run (remote) or db:backup-config-last-run:local
ALTER TABLE backup_config ADD COLUMN last_r2_backup_at TEXT;
