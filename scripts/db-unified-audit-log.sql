-- Unified audit log table — single source of truth for all auditable events.
-- All existing domain-specific tables (arb_audit_log, vendor_audit_log, etc.) continue
-- to receive writes for backward compat; this table receives ALL events going forward.
--
-- Retention: 7 years minimum for financial/compliance events (FL §720.303), 1 year for others.
-- Cleanup is handled by the scheduled worker respecting the retention_years column.

CREATE TABLE IF NOT EXISTS unified_audit_log (
  id              TEXT NOT NULL PRIMARY KEY,
  timestamp       DATETIME NOT NULL DEFAULT (datetime('now')),

  -- Who did it
  actor_email     TEXT NOT NULL,
  actor_role      TEXT,                    -- effective role at time of action
  ip_address      TEXT,
  session_id      TEXT,

  -- What happened
  category        TEXT NOT NULL,           -- auth | user | arb | directory | vendor |
                                           -- compliance | financial | document | meeting |
                                           -- maintenance | feedback | system | security
  action          TEXT NOT NULL,           -- snake_case action key (e.g. payment_recorded)
  action_label    TEXT,                    -- human-readable (e.g. "Payment recorded")
  outcome         TEXT NOT NULL DEFAULT 'success', -- success | failure | partial

  -- What was affected
  resource_type   TEXT,                    -- user | arb_request | owner | vendor | payment | ...
  resource_id     TEXT,                    -- ID of the affected resource
  target_email    TEXT,                    -- when acting on another user/owner

  -- Extra context
  details         TEXT,                    -- JSON blob

  -- Grouping
  correlation_id  TEXT,                    -- group related events (batch imports, etc.)

  -- Retention policy: how long this row must be kept before cleanup is allowed
  retention_years INTEGER NOT NULL DEFAULT 1
);

-- Indexes for the viewer's filter queries
CREATE INDEX IF NOT EXISTS idx_ual_timestamp      ON unified_audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ual_actor          ON unified_audit_log (actor_email);
CREATE INDEX IF NOT EXISTS idx_ual_category       ON unified_audit_log (category);
CREATE INDEX IF NOT EXISTS idx_ual_action         ON unified_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_ual_resource       ON unified_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_ual_target         ON unified_audit_log (target_email);
CREATE INDEX IF NOT EXISTS idx_ual_outcome        ON unified_audit_log (outcome);
CREATE INDEX IF NOT EXISTS idx_ual_correlation    ON unified_audit_log (correlation_id);
CREATE INDEX IF NOT EXISTS idx_ual_category_ts    ON unified_audit_log (category, timestamp DESC);
