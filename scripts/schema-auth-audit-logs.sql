-- Auth Phase 1: Comprehensive audit logging for all security events
-- Logs all authentication, authorization, and administrative actions
-- Required for compliance, incident response, and security monitoring

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, -- UUID v4
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Event classification
  event_type TEXT NOT NULL, -- 'login', 'logout', 'password_change', 'role_change', 'mfa_enable', etc.
  event_category TEXT NOT NULL, -- 'authentication', 'authorization', 'administrative', 'security'
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'

  -- Actor (who performed the action)
  user_id TEXT DEFAULT NULL, -- Email of user who performed the action (NULL for unauthenticated)

  -- Target (who was affected)
  target_user_id TEXT DEFAULT NULL, -- Email of user affected by the action (for admin operations)

  -- Request context
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  correlation_id TEXT DEFAULT NULL, -- For tracing related events across services

  -- Action details
  action TEXT NOT NULL, -- Specific action taken (e.g., 'login_success', 'login_failed_invalid_password')
  outcome TEXT DEFAULT 'success', -- 'success', 'failure', 'denied'

  -- Additional context (JSON for flexibility)
  details TEXT DEFAULT NULL, -- JSON: additional event-specific data

  -- Resource information
  resource_type TEXT DEFAULT NULL, -- 'user', 'session', 'role', 'permission'
  resource_id TEXT DEFAULT NULL
);

-- Indexes for audit log queries (admins need fast filtering)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON audit_logs(target_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(event_category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs(outcome, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id);

-- Retention policy: Keep logs for minimum 90 days, recommended 1 year
-- Cleanup job: DELETE FROM audit_logs WHERE timestamp < datetime('now', '-365 days');
