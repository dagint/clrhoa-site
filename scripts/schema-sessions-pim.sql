-- Add PIM (Privileged Identity Management) columns to sessions table for Lucia
-- Supports JIT elevation and role assumption for admin users
--
-- Run with:
-- Local:  npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-sessions-pim.sql
-- Remote: npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-sessions-pim.sql

-- Add elevated_until column (Unix timestamp in milliseconds)
ALTER TABLE sessions ADD COLUMN elevated_until INTEGER DEFAULT NULL;

-- Add assumed_role column ('board' or 'arb' for admin/arb_board users)
ALTER TABLE sessions ADD COLUMN assumed_role TEXT DEFAULT NULL;

-- Add assumed_at column (Unix timestamp in milliseconds)
ALTER TABLE sessions ADD COLUMN assumed_at INTEGER DEFAULT NULL;

-- Add assumed_until column (Unix timestamp in milliseconds)
ALTER TABLE sessions ADD COLUMN assumed_until INTEGER DEFAULT NULL;

-- Create index on elevated_until for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_elevated ON sessions(elevated_until);
