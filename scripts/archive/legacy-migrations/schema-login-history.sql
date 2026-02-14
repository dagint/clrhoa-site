-- Login history for "last logon" and "previous logons" on profile.
-- Run: npm run db:login-history:local or db:login-history (remote)

CREATE TABLE IF NOT EXISTS login_history (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email);
CREATE INDEX IF NOT EXISTS idx_login_history_logged_at ON login_history(logged_at DESC);
