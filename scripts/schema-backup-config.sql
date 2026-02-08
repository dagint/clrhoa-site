-- Backup configuration for Board/Admin: Google Drive target and schedule.
-- Run: npm run db:backup-config (remote) or db:backup-config:local

CREATE TABLE IF NOT EXISTS backup_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  google_drive_enabled INTEGER NOT NULL DEFAULT 0,
  google_refresh_token_encrypted TEXT,
  google_drive_folder_id TEXT,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_hour_utc INTEGER NOT NULL DEFAULT 2,
  schedule_day_of_week INTEGER,
  include_r2_manifest INTEGER NOT NULL DEFAULT 0,
  include_r2_files INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Single row: only one config
INSERT OR IGNORE INTO backup_config (id, google_drive_enabled, schedule_type, schedule_hour_utc)
VALUES (1, 0, 'daily', 2);
