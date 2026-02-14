-- Auth Phase 1: Database-backed session storage
-- Migrates from cookie-only sessions to database-backed sessions for better control
-- Supports session revocation, concurrent session limits, and anomaly detection

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, -- Session ID (cryptographically random)
  user_id TEXT NOT NULL, -- References users.email
  expires_at DATETIME NOT NULL, -- Absolute expiration (max 24 hours from creation)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP, -- Sliding window (15 min)
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  fingerprint TEXT DEFAULT NULL, -- Hash of IP + User-Agent for anomaly detection
  is_active INTEGER DEFAULT 1, -- 0 = revoked, 1 = active
  revoked_at DATETIME DEFAULT NULL,
  revoked_by TEXT DEFAULT NULL, -- Email of user/admin who revoked this session
  revoke_reason TEXT DEFAULT NULL, -- 'user_logout', 'admin_revoke', 'password_change', 'suspicious_activity'

  -- Session metadata (JSON fields for flexibility)
  device_info TEXT DEFAULT NULL, -- JSON: browser, OS, device type
  location_info TEXT DEFAULT NULL, -- JSON: country, city (from IP geolocation, optional)

  FOREIGN KEY (user_id) REFERENCES users(email) ON DELETE CASCADE
);

-- Indexes for session operations
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active, user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- Note: Concurrent session limit (3 per user) enforced in application code
-- Cleanup job should delete expired sessions: DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP
