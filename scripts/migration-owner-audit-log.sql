-- Migration: Add owner_audit_log table for directory audit trail
-- Purpose: Track all owner/directory CRUD operations for HOA compliance and security
-- Florida Statute 720: Requires proper record-keeping for HOA operations

CREATE TABLE IF NOT EXISTS owner_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,              -- FK to owners.id
  owner_name TEXT,                     -- Snapshot of name at time of action
  owner_email TEXT,                    -- Snapshot of email at time of action
  action TEXT NOT NULL,                -- 'created', 'updated', 'deleted', 'created_via_csv_upload', 'updated_via_csv_upload'

  -- Actor information
  changed_by_email TEXT,               -- Who performed the action
  changed_by_role TEXT,                -- Role of actor at time of action
  ip_address TEXT,                     -- Client IP address

  -- Change tracking
  old_values TEXT,                     -- JSON: old field values (for updates/deletes)
  new_values TEXT,                     -- JSON: new field values (for creates/updates)
  fields_changed TEXT,                 -- Comma-separated list of changed fields

  -- Metadata
  operation_type TEXT,                 -- 'manual', 'csv_upload', 'api', 'system'
  correlation_id TEXT,                 -- For tracking related operations

  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_owner_audit_owner ON owner_audit_log(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_audit_email ON owner_audit_log(changed_by_email);
CREATE INDEX IF NOT EXISTS idx_owner_audit_created ON owner_audit_log(created DESC);
CREATE INDEX IF NOT EXISTS idx_owner_audit_action ON owner_audit_log(action);

-- Note: Run this migration with:
-- wrangler d1 execute clrhoa_db --remote --file=scripts/migration-owner-audit-log.sql
