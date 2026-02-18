-- ============================================================================
-- Fix Missing User IDs for Lucia Compatibility
-- ============================================================================
-- This migration ensures all users have an 'id' field set (required by Lucia).
-- For users where id is NULL, set id = email for compatibility.
--
-- Issue: #276 - Users redirected back to login page after successful login
-- Root cause: New users created without 'id' field, causing Lucia session
-- validation to fail.
--
-- Usage:
--   npm run wrangler d1 execute clrhoa_db --local --file=./scripts/fix-missing-user-ids.sql
--   npm run wrangler d1 execute clrhoa_db --remote --file=./scripts/fix-missing-user-ids.sql
-- ============================================================================

-- Update users table: set id = email where id is NULL
UPDATE users
SET id = email
WHERE id IS NULL;

-- Verify the fix
SELECT
  COUNT(*) as total_users,
  COUNT(id) as users_with_id,
  COUNT(*) - COUNT(id) as users_missing_id
FROM users;
