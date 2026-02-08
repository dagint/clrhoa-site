-- Admin assume-role audit: when admins assume or clear Board/ARB role, and when they perform actions while assumed.
-- Run manually or via db:migrate. Table is optional; assume-role API logs here when DB is available.

CREATE TABLE IF NOT EXISTS admin_assumed_role_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  role_assumed TEXT,
  action_detail TEXT,
  ip_address TEXT,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_assumed_role_admin ON admin_assumed_role_audit(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_assumed_role_created ON admin_assumed_role_audit(created);
