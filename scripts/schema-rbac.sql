-- ============================================================================
-- RBAC SCHEMA: Role-Based Access Control & Route Permissions
-- ============================================================================
-- This script creates the RBAC infrastructure including:
-- - route_permissions: Dynamic permission overrides for routes
--
-- Default permissions are defined in PROTECTED_ROUTES (src/utils/rbac.ts).
-- This table stores admin-configured overrides.
--
-- Permission levels:
-- - none: No access (403 Forbidden)
-- - read: View-only access
-- - write: Full access (view + modify)
--
-- Usage:
--   npm run db:schema:rbac:local   (local development)
--   npm run db:schema:rbac         (production)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Route Permissions Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_permissions (
  id TEXT PRIMARY KEY,
  route_path TEXT NOT NULL,
  role TEXT NOT NULL,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('none', 'read', 'write')),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  UNIQUE(route_path, role)
);

-- Route permissions indexes
CREATE INDEX IF NOT EXISTS idx_route_permissions_path ON route_permissions(route_path);
CREATE INDEX IF NOT EXISTS idx_route_permissions_role ON route_permissions(role);
CREATE INDEX IF NOT EXISTS idx_route_permissions_updated_at ON route_permissions(updated_at);

-- ----------------------------------------------------------------------------
-- Notes on RBAC System
-- ----------------------------------------------------------------------------
-- The RBAC system works as follows:
-- 1. PROTECTED_ROUTES in src/utils/rbac.ts defines default permissions
-- 2. route_permissions table stores admin overrides (optional)
-- 3. canAccess() function checks both layers:
--    a. First checks route_permissions for overrides
--    b. Falls back to PROTECTED_ROUTES defaults
-- 4. Middleware enforces access on every request
-- 5. Admin UI at /portal/admin/permissions manages overrides
--
-- Roles (in order of privilege):
-- - member: Basic homeowner access
-- - arb: ARB committee member
-- - board: Board member
-- - arb_board: Combined ARB + Board member
-- - admin: System administrator
--
-- Route examples:
-- - /portal/dashboard → member (all roles can access)
-- - /portal/board/meetings → board, arb_board, admin only
-- - /portal/admin → admin only
-- ============================================================================
