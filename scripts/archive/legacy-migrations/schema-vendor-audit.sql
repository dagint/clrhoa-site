-- Audit log for vendor list changes (create, update, delete). Board transparency.
-- Run: npm run db:vendor-audit:local or db:vendor-audit (remote)

CREATE TABLE IF NOT EXISTS vendor_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT,
  action TEXT NOT NULL,
  done_by_email TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_created ON vendor_audit_log(created);
