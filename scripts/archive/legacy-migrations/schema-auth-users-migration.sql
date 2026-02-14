-- Auth Phase 1: Migrate users table to support password-based authentication
-- Run after schema.sql (existing users table with email, role, name, created)
-- This migration adds columns needed for password auth, MFA, security, and audit

-- Add password authentication columns
ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN password_changed_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN previous_password_hashes TEXT DEFAULT NULL; -- JSON array of last 5 password hashes

-- Add account status and security columns
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'; -- 'active', 'inactive', 'locked'
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_failed_login DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN locked_until DATETIME DEFAULT NULL; -- NULL = not locked, timestamp = locked until this time

-- Add MFA columns (secrets stored encrypted in KV, flags in D1)
ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0; -- 0 = disabled, 1 = enabled
ALTER TABLE users ADD COLUMN mfa_enabled_at DATETIME DEFAULT NULL;

-- Add last login tracking
ALTER TABLE users ADD COLUMN last_login DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN last_login_ip TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN last_login_user_agent TEXT DEFAULT NULL;

-- Add audit columns
ALTER TABLE users ADD COLUMN created_by TEXT DEFAULT NULL; -- Email of admin/board who created this user
ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT NULL; -- Set in application code on updates
ALTER TABLE users ADD COLUMN updated_by TEXT DEFAULT NULL; -- Email of last person who updated this record

-- Note: phone and sms_optin columns already exist (added in earlier migrations)
-- Note: password_hash NULL = user hasn't set password yet (legacy KV whitelist users)
-- During migration period, login will check: if password_hash exists, verify it; else fall back to KV whitelist
-- After all users migrate, KV whitelist can be deprecated
