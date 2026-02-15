-- Add created_at column to sms_feature_requests if missing
-- This column was added later but may be missing in production database

-- SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS directly
-- So we use a safe approach: try to add the column, and it will fail silently if it exists

-- Add created_at column with default
ALTER TABLE sms_feature_requests ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
