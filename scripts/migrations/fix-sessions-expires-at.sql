-- Migration: Fix sessions.expires_at from DATETIME to INTEGER
-- Lucia expects Unix timestamps (seconds since epoch) as INTEGER, not DATETIME strings
--
-- This fixes the login redirect loop where sessions were being created but
-- validation was failing due to type mismatch

-- Step 1: Create new sessions table with correct schema
CREATE TABLE IF NOT EXISTS sessions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- Changed from DATETIME to INTEGER
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  fingerprint TEXT DEFAULT NULL,
  is_active INTEGER DEFAULT 1,
  revoked_at DATETIME DEFAULT NULL,
  revoked_by TEXT DEFAULT NULL,
  revoke_reason TEXT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

-- Step 2: Copy data from old table (if any exists)
-- Handle both DATETIME strings and Unix timestamps
INSERT INTO sessions_new (
  id, user_id, expires_at, created_at, last_activity,
  ip_address, user_agent, fingerprint, is_active,
  revoked_at, revoked_by, revoke_reason
)
SELECT
  id,
  user_id,
  -- If expires_at is already a Unix timestamp (number > 1000000000), keep it
  -- Otherwise, try to convert from DATETIME string
  CASE
    WHEN CAST(expires_at AS INTEGER) > 1000000000 THEN CAST(expires_at AS INTEGER)
    ELSE CAST(strftime('%s', expires_at) AS INTEGER)
  END,
  created_at,
  last_activity,
  ip_address,
  user_agent,
  fingerprint,
  is_active,
  revoked_at,
  revoked_by,
  revoke_reason
FROM sessions
WHERE EXISTS (SELECT 1 FROM sessions);

-- Step 3: Drop old table
DROP TABLE sessions;

-- Step 4: Rename new table
ALTER TABLE sessions_new RENAME TO sessions;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
