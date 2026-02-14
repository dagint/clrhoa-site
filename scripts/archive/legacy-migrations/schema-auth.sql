-- ============================================================================
-- AUTH SCHEMA: Password-Based Authentication & Security
-- ============================================================================
-- This script creates the authentication infrastructure including:
-- - Password reset/setup tokens
-- - Session management (DB-backed)
-- - MFA/TOTP backup codes
-- - Audit logging (comprehensive security trail)
-- - Security events monitoring
--
-- This extends the users table (created in schema-core.sql) with
-- password-based authentication capabilities.
--
-- Usage:
--   npm run db:schema:auth:local   (local development)
--   npm run db:schema:auth         (production)
--
-- IMPORTANT: Users table must exist first (run schema-core.sql first)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Password Reset Tokens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);

-- ----------------------------------------------------------------------------
-- Password Setup Tokens (for new user onboarding)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_setup_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_user_id ON password_setup_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_token_hash ON password_setup_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_expires_at ON password_setup_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_used ON password_setup_tokens(used);

-- ----------------------------------------------------------------------------
-- Sessions (Database-backed for advanced features)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- ----------------------------------------------------------------------------
-- MFA Backup Codes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_used ON mfa_backup_codes(used);

-- ----------------------------------------------------------------------------
-- Audit Logs (Comprehensive Security Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  user_id TEXT DEFAULT NULL,
  target_user_id TEXT DEFAULT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  correlation_id TEXT DEFAULT NULL,
  action TEXT NOT NULL,
  outcome TEXT DEFAULT 'success',
  details TEXT DEFAULT NULL,
  resource_type TEXT DEFAULT NULL,
  resource_id TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs(outcome);

-- ----------------------------------------------------------------------------
-- Security Events (Critical Security Monitoring)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  user_id TEXT DEFAULT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  correlation_id TEXT DEFAULT NULL,
  details TEXT DEFAULT NULL,
  auto_remediated INTEGER DEFAULT 0,
  remediation_action TEXT DEFAULT NULL,
  resolved INTEGER DEFAULT 0,
  resolved_by TEXT DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_correlation_id ON security_events(correlation_id);

-- ============================================================================
-- Notes on Authentication System
-- ============================================================================
-- Password Security:
--   - Passwords hashed with bcrypt or argon2 (configurable)
--   - Password history tracking (prevent reuse of last 5 passwords)
--   - Automatic lockout after 5 failed attempts (15 min cooldown)
--   - Password strength requirements enforced
--
-- Session Management:
--   - HttpOnly session cookies (XSS protection)
--   - Session fingerprinting (IP + User-Agent)
--   - Automatic expiration (30 days default)
--   - Admin can revoke sessions remotely
--   - Concurrent session limits per user
--
-- MFA/TOTP:
--   - Optional per-user enrollment
--   - 10 backup codes generated on setup
--   - QR code enrollment via authenticator app
--   - Backup codes one-time use only
--
-- Audit Logging:
--   - All auth events logged (login, logout, password change)
--   - Authorization events (permission checks, access denials)
--   - Administrative events (role changes, user creation)
--   - Retention: 365 days for audit_logs, 730 days for security_events
--
-- Security Events:
--   - Rate limit violations
--   - Account lockouts
--   - Suspicious login attempts
--   - MFA bypass attempts
--   - Automatic remediation tracking
--   - Requires manual resolution for critical events
--
-- Compliance:
--   - Supports Florida Statute 720.303(4) audit requirements
--   - Immutable audit trail (no UPDATE/DELETE on logs)
--   - Correlation IDs for request tracing
--   - Timestamp precision to milliseconds
-- ============================================================================
