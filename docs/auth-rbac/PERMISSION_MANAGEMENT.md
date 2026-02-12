# Permission Management System

## Overview

The Permission Management System provides a secure, Admin-only interface for managing role-based access control (RBAC) permissions across all portal routes. Admins can define per-page permissions for each role (Member, ARB, Board, Admin) with three levels: None, Read, Write.

## Access

**Admin-Only**: Only users with `effectiveRole === 'admin'` can access the permission management interface at `/portal/admin/permissions`. All API endpoints enforce admin-only access server-side.

## Permission Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| **None** | No access to route | User is redirected to login or dashboard |
| **Read** | View-only access | User can view data but cannot create, edit, or delete |
| **Write** | Full access | User can view, create, edit, and delete data |

## Architecture

### Database Schema

**Table: `route_permissions`**
```sql
CREATE TABLE route_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_path TEXT NOT NULL,
  role TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'none',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  UNIQUE(route_path, role)
);
```

**Table: `route_permissions_audit`**
```sql
CREATE TABLE route_permissions_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_path TEXT NOT NULL,
  role TEXT NOT NULL,
  old_permission TEXT,
  new_permission TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  changed_by TEXT NOT NULL,
  ip_address TEXT
);
```

### Components

1. **Page**: `/src/pages/portal/admin/permissions.astro`
   - Admin-only permission management UI
   - Stats dashboard
   - Permission grid display
   - Help documentation

2. **Component**: `/src/components/PermissionGrid.astro`
   - Interactive permission table
   - Client-side change staging
   - Filter and search
   - Bulk actions

3. **API**: `/src/pages/api/admin/permissions.astro`
   - GET: Load all permissions
   - PUT: Save permission changes
   - Admin-only enforcement

4. **Database Library**: `/src/lib/permissions-db.ts`
   - CRUD operations for permissions
   - Audit logging
   - Bulk updates
   - Permission validation

## API Reference

### GET `/api/admin/permissions`

**Purpose**: Load all route permissions

**Auth**: Admin only (checked via `getEffectiveRole`)

**Response**:
```json
{
  "/portal/board/meetings": {
    "member": "none",
    "arb": "read",
    "board": "write",
    "admin": "write"
  },
  "/portal/arb-dashboard": {
    "member": "none",
    "arb": "write",
    "board": "read",
    "admin": "write"
  }
}
```

---

### GET `/api/permissions/for-role?role=<role>`

**Purpose**: Get all permissions for a specific role

**Auth**: Authenticated users can query their own role. Admins can query any role.

**Query Parameters**:
- `role` (required): One of `member`, `arb`, `board`, `admin`

**Request Example**:
```
GET /api/permissions/for-role?role=member
```

**Response**:
```json
{
  "role": "member",
  "permissions": {
    "/portal/dashboard": "write",
    "/portal/directory": "write",
    "/portal/admin": "none",
    "/board/meetings": "none"
  },
  "count": 52
}
```

**Authorization Rules**:
- Members can only query `?role=member`
- ARB can only query `?role=arb`
- Board can only query `?role=board`
- Admins can query any role

**Error Responses**:
- `400 Bad Request`: Missing or invalid role parameter
- `401 Unauthorized`: No session
- `403 Forbidden`: Trying to query another role (non-admin)

**Error Responses**:
- `401 Unauthorized`: No session
- `403 Forbidden`: Not admin
- `500 Internal Server Error`: Database error

---

### PUT `/api/admin/permissions`

**Purpose**: Save route permission changes

**Auth**: Admin only (checked via `getEffectiveRole`)

**Request Body**:
```json
{
  "permissions": {
    "/portal/board/meetings": {
      "member": "none",
      "arb": "read",
      "board": "write",
      "admin": "write"
    }
  }
}
```

**Validation**:
- `permissions` must be an object
- Each route must have an object of role-permission pairs
- Permission levels must be: `none`, `read`, or `write`
- Roles must be: `member`, `arb`, `board`, or `admin`

**Response (Success)**:
```json
{
  "success": true,
  "updated": 12,
  "message": "Updated 12 permissions"
}
```

**Response (Partial Success)**:
```json
{
  "success": true,
  "updated": 10,
  "errors": [
    "Failed to update /portal/board/meetings for admin: Database error"
  ],
  "warning": "Some updates failed"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid permissions object or levels
- `401 Unauthorized`: No session
- `403 Forbidden`: Not admin
- `500 Internal Server Error`: Database error

## Usage

### Admin Workflow

1. **Navigate**: Go to `/portal/admin/permissions`
2. **Filter** (Optional): Type in filter box to search routes
3. **Edit**: Use dropdowns to change permission levels
   - Changed cells are highlighted in amber
   - Change counter shows pending edits
4. **Bulk Actions** (Optional):
   - "Set All to Read" - Sets all visible routes to read
   - "Set All to Write" - Sets all visible routes to write
   - "Set All to None" - Sets all visible routes to none
5. **Save**: Click "Save Changes" to persist updates
6. **Revert** (if needed): Click "Revert" to undo pending changes

### Database Functions

#### `getAllPermissions(db: D1Database): Promise<PermissionMap>`
Get all route permissions as nested object.

```typescript
const permissions = await getAllPermissions(db);
// { "/portal/board/meetings": { "member": "none", ... } }
```

#### `getRoutePermissions(db: D1Database, routePath: string): Promise<Record<string, PermissionLevel>>`
Get permissions for a specific route.

```typescript
const perms = await getRoutePermissions(db, '/portal/board/meetings');
// { "member": "none", "arb": "read", "board": "write", "admin": "write" }
```

#### `setPermission(db, routePath, role, permissionLevel, changedBy, ipAddress?): Promise<void>`
Set permission for a single route/role combination.

```typescript
await setPermission(db, '/portal/board/meetings', 'arb', 'write', 'admin@clrhoa.com', '192.168.1.1');
```

#### `bulkUpdatePermissions(db, permissionMap, changedBy, ipAddress?): Promise<{ updated: number; errors: string[] }>`
Bulk update permissions (used by admin UI).

```typescript
const result = await bulkUpdatePermissions(db, permissions, 'admin@clrhoa.com', '192.168.1.1');
// { updated: 12, errors: [] }
```

#### `hasPermission(db, routePath, role, requiredLevel): Promise<boolean>`
Check if a role has required permission level for a route.

```typescript
const canWrite = await hasPermission(db, '/portal/board/meetings', 'board', 'write');
// true
```

#### `seedDefaultPermissions(db, routes): Promise<number>`
Seed default permissions from `PROTECTED_ROUTES` constant.

```typescript
import { PROTECTED_ROUTES } from '../utils/rbac';
const seeded = await seedDefaultPermissions(db, PROTECTED_ROUTES);
// 208 (52 routes × 4 roles)
```

### Helper Utilities (`src/utils/permissions.ts`)

#### `canAccess(role, path, required, db?): Promise<boolean>`
Check if a role can access a path with the required permission level.

```typescript
import { canAccess } from '../utils/permissions';

// Check if member can read dashboard
const canView = await canAccess('member', '/portal/dashboard', 'read', db);

// Check if board can write to meetings
const canEdit = await canAccess('board', '/board/meetings', 'write', db);

// Defaults to 'read' if not specified
const hasAccess = await canAccess('arb', '/portal/arb-dashboard', undefined, db);
```

**Fallback**: If `db` is not provided, uses static `PROTECTED_ROUTES` configuration.

#### `getRolePermissions(role, db?): Promise<Record<string, PermissionLevel>>`
Get all permissions for a specific role.

```typescript
import { getRolePermissions } from '../utils/permissions';

const memberPerms = await getRolePermissions('member', db);
// {
//   "/portal/dashboard": "write",
//   "/portal/directory": "write",
//   "/portal/admin": "none",
//   ...
// }
```

#### `canPerformAction(role, path, action, db?): Promise<boolean>`
Check if a role can perform a specific action on a path.

```typescript
import { canPerformAction } from '../utils/permissions';

// Actions: 'view', 'create', 'edit', 'delete'
const canView = await canPerformAction('member', '/portal/dashboard', 'view', db);
const canEdit = await canPerformAction('board', '/board/meetings', 'edit', db);
const canDelete = await canPerformAction('admin', '/portal/admin', 'delete', db);
```

**Action Mapping**:
- `view` → requires `read` permission
- `create`, `edit`, `delete` → require `write` permission

#### `getAccessiblePaths(role, minLevel, db?): Promise<string[]>`
Get all paths accessible by a role at a given permission level.

```typescript
import { getAccessiblePaths } from '../utils/permissions';

// Get all readable paths for member
const readablePaths = await getAccessiblePaths('member', 'read', db);
// ["/portal/dashboard", "/portal/directory", ...]

// Get all writable paths for board
const writablePaths = await getAccessiblePaths('board', 'write', db);
// ["/board/meetings", "/board/directory", ...]
```

#### Validation Helpers

```typescript
import { isValidPermissionLevel, isValidRole, getPermissionLevelLabel, getRoleLabel } from '../utils/permissions';

// Validate input
if (!isValidRole(userInput)) {
  throw new Error('Invalid role');
}

if (!isValidPermissionLevel(level)) {
  throw new Error('Invalid permission level');
}

// Get display labels
const label = getPermissionLevelLabel('read'); // "Read Only"
const roleLabel = getRoleLabel('admin'); // "Administrator"
```

### Admin Authorization Middleware (`src/middleware/withAdminAuthorization.ts`)

#### `withAdminAuthorization(Astro): Promise<AdminAuthCheck>`
Reusable middleware for protecting admin-only endpoints.

```typescript
import { withAdminAuthorization } from '../middleware/withAdminAuthorization';

// In API endpoint
const auth = await withAdminAuthorization(Astro);
if (!auth.authorized) return auth.response;

// Now TypeScript knows auth has session and env
const { session, env } = auth;
const db = env.DB;
```

**Returns**:
- If authorized: `{ authorized: true, session, env }`
- If not authorized: `{ authorized: false, response }` (401/403 response ready to return)

#### `isAdmin(Astro): Promise<boolean>`
Simple boolean check for admin status.

```typescript
import { isAdmin } from '../middleware/withAdminAuthorization';

if (!await isAdmin(Astro)) {
  return new Response('Forbidden', { status: 403 });
}
```

#### `requireAdmin(Astro): Promise<{ session, env }>`
Throws response if not admin (for endpoints that always require admin).

```typescript
import { requireAdmin } from '../middleware/withAdminAuthorization';

// Will throw 401/403 response if not admin
const { session, env } = await requireAdmin(Astro);

// Code here only runs if admin
const db = env.DB;
```

### Static Fallback (`data/permissions.json`)

When database is not available (local development, testing), the system falls back to static permissions:

```json
{
  "permissions": {
    "/portal/dashboard": {
      "member": "write",
      "arb": "write",
      "board": "write",
      "admin": "write"
    },
    "/portal/admin": {
      "member": "none",
      "arb": "none",
      "board": "none",
      "admin": "write"
    }
  }
}
```

Helper functions automatically use this fallback when `db` parameter is undefined.

## Security

### Server-Side Enforcement

- All API endpoints check `getEffectiveRole(session) === 'admin'`
- Session validation via signed cookies (HMAC-SHA256)
- No client-side permission checks bypass server enforcement

### Audit Logging

Every permission change is logged with:
- **route_path**: Which route was modified
- **role**: Which role's permission changed
- **old_permission**: Previous permission level
- **new_permission**: New permission level
- **changed_at**: Timestamp (ISO 8601)
- **changed_by**: Admin email who made the change
- **ip_address**: IP address of admin (from `cf-connecting-ip` header)

### Validation

- Permission levels validated: must be `none`, `read`, or `write`
- Roles validated: must be `member`, `arb`, `board`, or `admin`
- Route paths validated: must exist in `PROTECTED_ROUTES`
- Malformed requests return 400 Bad Request

### Session Security

- HttpOnly cookies prevent XSS attacks
- Signed cookies prevent tampering
- 30-minute inactivity timeout
- Session fingerprinting (browser + IP hash)
- PIM elevation required for admin access (2-hour window)

## Database Setup

### Local Development

```bash
# Create tables
wrangler d1 execute clrhoa_db --local --file=./scripts/schema-route-permissions.sql

# Seed default permissions (optional)
# Run seed script or use seedDefaultPermissions() function
```

### Production

```bash
# Create tables
wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-route-permissions.sql

# Seed defaults
# Use admin UI or seedDefaultPermissions() via script
```

## Examples

### Example 1: Grant ARB Read Access to Board Meetings

1. Navigate to `/portal/admin/permissions`
2. Filter for "meetings"
3. Find `/portal/board/meetings` row
4. Change ARB column from "None" to "Read"
5. Click "Save Changes"

**Result**: ARB members can now view meetings but cannot edit.

---

### Example 2: Bulk Set All Member Routes to None

1. Navigate to `/portal/admin/permissions`
2. Filter for "/portal/dashboard" (or leave blank for all)
3. Click "Set All to None"
4. Review changes (highlighted in amber)
5. Click "Save Changes"

**Result**: All visible routes set to "none" for member role.

---

### Example 3: Audit Recent Permission Changes

**Query audit log:**
```typescript
import { getPermissionAuditLog } from '../lib/permissions-db';

const recentChanges = await getPermissionAuditLog(db, {
  limit: 50,
  offset: 0,
});

recentChanges.forEach((change) => {
  console.log(`${change.changed_by} changed ${change.route_path} for ${change.role}`);
  console.log(`  ${change.old_permission} → ${change.new_permission} at ${change.changed_at}`);
});
```

## Best Practices

### ✅ Do

- **Test changes** in incognito mode with a non-admin account
- **Document significant changes** in your change log
- **Use bulk actions** for consistent permission patterns
- **Review audit logs** regularly for unauthorized changes
- **Grant least privilege** - start with "none" or "read", escalate to "write" only when needed
- **Filter before bulk actions** to avoid unintended changes

### ❌ Don't

- Don't set critical routes like `/portal/dashboard` to "none" for all roles
- Don't bypass server-side enforcement (all checks are server-side)
- Don't grant "write" permission casually - it allows full CRUD operations
- Don't forget to save changes - pending changes are lost on page refresh
- Don't make changes without understanding the impact on users

## Troubleshooting

### Issue: Changes Not Saving

**Symptoms**: Click "Save Changes" but permissions revert

**Causes**:
1. Database not connected
2. Session expired (30min inactivity)
3. Not elevated as admin (PIM expired)

**Solution**:
- Check browser console for API errors
- Verify `env.DB` is bound in `wrangler.toml`
- Re-elevate admin access via PIM
- Check network tab for 401/403 responses

---

### Issue: Permission Grid Empty

**Symptoms**: No routes shown in table

**Causes**:
1. `PROTECTED_ROUTES` not loaded
2. Database query failed
3. Routes filtered out

**Solution**:
- Check browser console for errors
- Clear filter input
- Verify `PROTECTED_ROUTES` exists in `src/utils/rbac.ts`

---

### Issue: Audit Log Not Recording

**Symptoms**: Changes saved but no audit entries

**Causes**:
1. `route_permissions_audit` table missing
2. Database write failed

**Solution**:
- Run schema script: `wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-route-permissions.sql`
- Check database logs in Cloudflare dashboard

## Future Enhancements

- [ ] Permission templates (e.g., "Board Admin", "ARB Reviewer")
- [ ] Role groups (e.g., "Board + ARB" auto-applies both)
- [ ] Permission inheritance (e.g., parent route permissions apply to children)
- [ ] Permission import/export (JSON/CSV)
- [ ] Permission change notifications (email admins on changes)
- [ ] Advanced audit log viewer with filtering and export
- [ ] Permission change preview (show affected users before save)
- [ ] Permission scheduling (e.g., temporary access grants)

---

**Last Updated**: 2026-02-10
**Status**: Active Implementation
**Maintainer**: Claude Code Assistant
