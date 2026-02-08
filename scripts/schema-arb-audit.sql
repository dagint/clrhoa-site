-- Audit log for ARB requests. Run after schema-arb.sql.
-- wrangler d1 execute clrhoa_db --local --file=./scripts/schema-arb-audit.sql
-- For remote: wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-arb-audit.sql

CREATE TABLE IF NOT EXISTS arb_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  changed_by_email TEXT,
  changed_by_role TEXT,
  notes TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES arb_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_arb_audit_request ON arb_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_arb_audit_created ON arb_audit_log(created);
