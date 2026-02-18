-- ============================================================================
-- Fix Sessions Table Foreign Key Constraint
-- ============================================================================
-- This migration fixes the sessions table foreign key to reference users(id)
-- instead of users(email), which is required for proper Lucia operation.
--
-- Issue: Sessions table has FOREIGN KEY (user_id) REFERENCES users(email)
-- Fix: Change to FOREIGN KEY (user_id) REFERENCES users(id)
--
-- Background: PR #279 fixed session creation to use user.id instead of email,
-- but the database schema still had the FK pointing to email column.
--
-- Usage:
--   npm run wrangler d1 execute clrhoa_db --remote --file=./scripts/fix-sessions-foreign-key.sql
-- ============================================================================

-- SQLite doesn't support ALTER TABLE to modify foreign keys
-- We need to recreate the table with the correct constraint

-- Step 1: Create new sessions table with correct foreign key
CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  fingerprint TEXT DEFAULT NULL,
  is_active INTEGER DEFAULT 1,
  revoked_at DATETIME DEFAULT NULL,
  revoked_by TEXT DEFAULT NULL,
  revoke_reason TEXT DEFAULT NULL,
  elevated_until INTEGER DEFAULT NULL,
  assumed_role TEXT DEFAULT NULL,
  assumed_at INTEGER DEFAULT NULL,
  assumed_until INTEGER DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table to new table
-- Update user_id from email to actual user.id during copy
INSERT INTO sessions_new
SELECT
  s.id,
  u.id as user_id,  -- Use actual user.id instead of email
  s.expires_at,
  s.created_at,
  s.last_activity,
  s.ip_address,
  s.user_agent,
  s.fingerprint,
  s.is_active,
  s.revoked_at,
  s.revoked_by,
  s.revoke_reason,
  s.elevated_until,
  s.assumed_role,
  s.assumed_at,
  s.assumed_until
FROM sessions s
INNER JOIN users u ON s.user_id = u.email;

-- Step 3: Drop old table
DROP TABLE sessions;

-- Step 4: Rename new table to sessions
ALTER TABLE sessions_new RENAME TO sessions;

-- Step 5: Verify the fix
SELECT
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id) as unique_users
FROM sessions;
