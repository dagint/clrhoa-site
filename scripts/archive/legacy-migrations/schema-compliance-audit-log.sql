-- Florida HOA Compliance Audit Log
-- Append-only audit trail for all compliance actions

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id TEXT PRIMARY KEY,                    -- e.g., 'clog_xyz789'
  requirement_id TEXT,
  document_id TEXT,
  action TEXT NOT NULL,                   -- 'DOCUMENT_UPLOADED', 'DOCUMENT_REPLACED', 'DOCUMENT_ARCHIVED', 'REQUIREMENT_REVIEWED'
  actor_email TEXT NOT NULL,
  metadata TEXT,                          -- JSON: additional context
  created_at TEXT NOT NULL                -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_requirement
  ON compliance_audit_log(requirement_id);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_created
  ON compliance_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_document
  ON compliance_audit_log(document_id);
