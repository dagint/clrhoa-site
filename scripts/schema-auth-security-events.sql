-- Auth Phase 1: Security event tracking for anomaly detection and alerting
-- Tracks suspicious activity, rate limit violations, and security incidents
-- Used by security dashboard and admin alerts

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY, -- UUID v4
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Event classification
  event_type TEXT NOT NULL, -- 'rate_limit_exceeded', 'account_locked', 'suspicious_login', 'session_hijacking_detected', 'token_reuse_attempt'
  severity TEXT DEFAULT 'warning', -- 'info', 'warning', 'critical'

  -- Affected user
  user_id TEXT DEFAULT NULL, -- Email of affected user (NULL if no user context)

  -- Request context
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  correlation_id TEXT DEFAULT NULL,

  -- Event details (JSON for flexibility)
  details TEXT DEFAULT NULL, -- JSON: event-specific data (e.g., failed attempt count, anomaly score)

  -- Security team response
  resolved INTEGER DEFAULT 0, -- 0 = unresolved, 1 = resolved
  resolved_by TEXT DEFAULT NULL, -- Email of admin who resolved
  resolved_at DATETIME DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL,

  -- Auto-remediation
  auto_remediated INTEGER DEFAULT 0, -- 0 = manual, 1 = auto-remediated (e.g., auto-locked account)
  remediation_action TEXT DEFAULT NULL -- 'account_locked', 'session_revoked', 'ip_blocked', 'alert_sent'
);

-- Indexes for security event queries
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved, severity, timestamp DESC);

-- Retention policy: Keep security events for 1 year minimum
-- Cleanup job: DELETE FROM security_events WHERE timestamp < datetime('now', '-730 days') AND resolved = 1;
