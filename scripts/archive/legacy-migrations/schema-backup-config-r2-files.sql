-- Add R2 file backup configuration options to backup_config table
-- This allows enabling/disabling R2 manifest and actual file uploads to Google Drive

ALTER TABLE backup_config ADD COLUMN include_r2_manifest INTEGER NOT NULL DEFAULT 1;
-- ^ Include R2 file manifest (inventory JSON) in Google Drive backups

ALTER TABLE backup_config ADD COLUMN include_r2_files INTEGER NOT NULL DEFAULT 0;
-- ^ Include actual R2 files in Google Drive backups (incremental, only new/changed files)
-- Default to 0 (off) since this can be large on first run
