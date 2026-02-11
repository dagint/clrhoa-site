-- Auth Phase 1: MFA backup codes table
-- Stores hashed backup codes for MFA recovery
-- Each user gets 10 single-use backup codes when MFA is enabled

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id TEXT PRIMARY KEY, -- UUID v4
  user_id TEXT NOT NULL, -- References users.email
  code_hash TEXT NOT NULL, -- bcrypt hash of backup code (NOT stored in plain text)
  used INTEGER DEFAULT 0, -- 0 = unused, 1 = used
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

-- Indexes for backup code lookups
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user ON mfa_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_used ON mfa_backup_codes(user_id, used);

-- Note: MFA secrets (TOTP) are stored encrypted in KV, not in D1
-- Backup codes are generated in sets of 10 when user enables MFA or regenerates codes
-- User can only use each code once; after all codes used, must regenerate or disable/re-enable MFA
