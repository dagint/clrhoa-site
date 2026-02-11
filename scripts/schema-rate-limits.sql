-- Rate Limits Table
-- Tracks rate limit attempts for login, password reset, and other security-sensitive operations.
-- Part of PR #3: Rate Limiting & Security Utilities

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  rate_limit_type TEXT NOT NULL,
  identifier TEXT NOT NULL,
  attempted_at DATETIME NOT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  correlation_id TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_type_identifier ON rate_limits(rate_limit_type, identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_attempted_at ON rate_limits(attempted_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
