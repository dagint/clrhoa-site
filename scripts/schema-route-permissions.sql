-- Route permissions: Admin-managed RBAC permissions for portal routes.
-- Stores per-route, per-role permission levels (none, read, write).
-- Run: wrangler d1 execute clrhoa_db --file=./scripts/schema-route-permissions.sql --remote

CREATE TABLE IF NOT EXISTS route_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_path TEXT NOT NULL,
  role TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'none',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  UNIQUE(route_path, role)
);

CREATE INDEX IF NOT EXISTS idx_route_permissions_path ON route_permissions(route_path);
CREATE INDEX IF NOT EXISTS idx_route_permissions_role ON route_permissions(role);
CREATE INDEX IF NOT EXISTS idx_route_permissions_level ON route_permissions(permission_level);

-- Audit log for permission changes
CREATE TABLE IF NOT EXISTS route_permissions_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_path TEXT NOT NULL,
  role TEXT NOT NULL,
  old_permission TEXT,
  new_permission TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  changed_by TEXT NOT NULL,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_route_permissions_audit_path ON route_permissions_audit(route_path);
CREATE INDEX IF NOT EXISTS idx_route_permissions_audit_user ON route_permissions_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_route_permissions_audit_date ON route_permissions_audit(changed_at);
