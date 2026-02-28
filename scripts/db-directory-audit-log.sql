-- Unified directory audit log
-- Replaces the two-table approach (directory_logs for views + owner_audit_log for CRUD)
-- with one table that uses an `operation` field to distinguish event types.
--
-- operation values:
--   view_phone       -- member revealed a phone number in the directory
--   view_email       -- member revealed an email address in the directory
--   export           -- elevated user exported the full directory
--   created          -- owner record created
--   updated          -- owner record updated
--   deleted          -- owner record deleted
--   csv_upload       -- owner record created/updated via bulk CSV
--   kv_removed       -- user removed from login whitelist (KV)
--
-- Historical data in directory_logs and owner_audit_log is preserved.
-- New writes go to this table. Old tables remain read-only for history.

CREATE TABLE IF NOT EXISTS directory_audit_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Actor (who performed the action)
  actor_email      TEXT,
  actor_role       TEXT,
  ip_address       TEXT,

  -- What happened
  operation        TEXT NOT NULL,
  operation_type   TEXT,  -- 'manual' | 'csv_upload' | 'api' | 'system'

  -- Subject (the directory entry affected)
  owner_id         TEXT,
  owner_name       TEXT,
  owner_email      TEXT,
  target_phone     TEXT,  -- for view_phone operations

  -- Change tracking (for created / updated / deleted)
  old_values       TEXT,  -- JSON snapshot of previous values
  new_values       TEXT,  -- JSON snapshot of new values
  fields_changed   TEXT,  -- comma-separated list of changed field names

  -- Correlation (for grouping CSV batch operations)
  correlation_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_dir_audit_timestamp    ON directory_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dir_audit_actor_email  ON directory_audit_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_dir_audit_owner_id     ON directory_audit_log(owner_id);
CREATE INDEX IF NOT EXISTS idx_dir_audit_owner_email  ON directory_audit_log(owner_email);
CREATE INDEX IF NOT EXISTS idx_dir_audit_operation    ON directory_audit_log(operation);
