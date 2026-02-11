-- Auth Phase 1: Password reset and setup token tables
-- Tokens are hashed (SHA-256) before storing for security
-- Tokens are single-use and expire after a set time

-- Password reset tokens (forgot password flow)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY, -- UUID v4
  user_id TEXT NOT NULL, -- References users.email
  token_hash TEXT NOT NULL, -- SHA-256 hash of the token (not stored in plain text)
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0, -- 0 = unused, 1 = used (single-use tokens)
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT DEFAULT NULL, -- IP that requested the reset
  user_agent TEXT DEFAULT NULL,

  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

-- Password setup tokens (new user onboarding)
CREATE TABLE IF NOT EXISTS password_setup_tokens (
  id TEXT PRIMARY KEY, -- UUID v4
  user_id TEXT NOT NULL, -- References users.email
  token_hash TEXT NOT NULL, -- SHA-256 hash of the token
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0, -- 0 = unused, 1 = used
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_count INTEGER DEFAULT 1, -- Track how many times setup email was resent
  sent_by TEXT DEFAULT NULL, -- Email of admin/board who sent/resent the setup email

  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

-- Indexes for token lookups (hash lookups are frequent)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_hash ON password_setup_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_user ON password_setup_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_expires ON password_setup_tokens(expires_at);
