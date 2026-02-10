/**
 * Route Permissions Database Library
 *
 * Manages RBAC permissions stored in D1.
 * Each route can have different permission levels per role: none, read, write.
 */

export type PermissionLevel = 'none' | 'read' | 'write';
export type RoleType = 'member' | 'arb' | 'board' | 'admin';

export interface RoutePermission {
  id: number;
  route_path: string;
  role: RoleType;
  permission_level: PermissionLevel;
  updated_at: string | null;
  updated_by: string | null;
}

export interface PermissionChange {
  route_path: string;
  role: RoleType;
  old_permission: PermissionLevel;
  new_permission: PermissionLevel;
  changed_by: string;
  ip_address?: string;
}

/**
 * Permission map: route_path -> { role -> permission_level }
 */
export type PermissionMap = Record<string, Record<string, PermissionLevel>>;

/**
 * Get all route permissions as a nested map
 */
export async function getAllPermissions(db: D1Database): Promise<PermissionMap> {
  const result = await db
    .prepare('SELECT route_path, role, permission_level FROM route_permissions ORDER BY route_path, role')
    .all<RoutePermission>();

  const map: PermissionMap = {};
  for (const row of result.results || []) {
    if (!map[row.route_path]) {
      map[row.route_path] = {};
    }
    map[row.route_path][row.role] = row.permission_level;
  }

  return map;
}

/**
 * Get permissions for a specific route
 */
export async function getRoutePermissions(
  db: D1Database,
  routePath: string
): Promise<Record<string, PermissionLevel>> {
  const result = await db
    .prepare('SELECT role, permission_level FROM route_permissions WHERE route_path = ?')
    .bind(routePath)
    .all<Pick<RoutePermission, 'role' | 'permission_level'>>();

  const permissions: Record<string, PermissionLevel> = {};
  for (const row of result.results || []) {
    permissions[row.role] = row.permission_level;
  }

  return permissions;
}

/**
 * Set permission for a route/role combination
 */
export async function setPermission(
  db: D1Database,
  routePath: string,
  role: RoleType,
  permissionLevel: PermissionLevel,
  changedBy: string,
  ipAddress?: string
): Promise<void> {
  // Get old permission for audit
  const old = await db
    .prepare('SELECT permission_level FROM route_permissions WHERE route_path = ? AND role = ?')
    .bind(routePath, role)
    .first<{ permission_level: PermissionLevel }>();

  // Insert or update permission
  await db
    .prepare(
      `INSERT INTO route_permissions (route_path, role, permission_level, updated_at, updated_by)
       VALUES (?, ?, ?, datetime('now'), ?)
       ON CONFLICT(route_path, role)
       DO UPDATE SET permission_level = ?, updated_at = datetime('now'), updated_by = ?`
    )
    .bind(routePath, role, permissionLevel, changedBy, permissionLevel, changedBy)
    .run();

  // Log audit trail
  await db
    .prepare(
      `INSERT INTO route_permissions_audit (route_path, role, old_permission, new_permission, changed_by, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(routePath, role, old?.permission_level || 'none', permissionLevel, changedBy, ipAddress || null)
    .run();
}

/**
 * Bulk update permissions (for admin UI save operation)
 */
export async function bulkUpdatePermissions(
  db: D1Database,
  permissionMap: PermissionMap,
  changedBy: string,
  ipAddress?: string
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  for (const [routePath, rolePerms] of Object.entries(permissionMap)) {
    for (const [role, level] of Object.entries(rolePerms)) {
      try {
        await setPermission(db, routePath, role as RoleType, level as PermissionLevel, changedBy, ipAddress);
        updated++;
      } catch (err) {
        errors.push(`Failed to update ${routePath} for ${role}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { updated, errors };
}

/**
 * Get permission audit log with optional filters
 */
export async function getPermissionAuditLog(
  db: D1Database,
  options: {
    routePath?: string;
    role?: string;
    changedBy?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  id: number;
  route_path: string;
  role: string;
  old_permission: string | null;
  new_permission: string;
  changed_at: string;
  changed_by: string;
  ip_address: string | null;
}[]> {
  let sql = 'SELECT * FROM route_permissions_audit WHERE 1=1';
  const bindings: unknown[] = [];

  if (options.routePath) {
    sql += ' AND route_path = ?';
    bindings.push(options.routePath);
  }

  if (options.role) {
    sql += ' AND role = ?';
    bindings.push(options.role);
  }

  if (options.changedBy) {
    sql += ' AND changed_by = ?';
    bindings.push(options.changedBy);
  }

  sql += ' ORDER BY changed_at DESC';

  if (options.limit) {
    sql += ' LIMIT ?';
    bindings.push(options.limit);
  }

  if (options.offset) {
    sql += ' OFFSET ?';
    bindings.push(options.offset);
  }

  const result = await db.prepare(sql).bind(...bindings).all();
  return result.results as {
    id: number;
    route_path: string;
    role: string;
    old_permission: string | null;
    new_permission: string;
    changed_at: string;
    changed_by: string;
    ip_address: string | null;
  }[];
}

/**
 * Check if a role has permission for a route
 */
export async function hasPermission(
  db: D1Database,
  routePath: string,
  role: RoleType,
  requiredLevel: PermissionLevel
): Promise<boolean> {
  const result = await db
    .prepare('SELECT permission_level FROM route_permissions WHERE route_path = ? AND role = ?')
    .bind(routePath, role)
    .first<{ permission_level: PermissionLevel }>();

  if (!result) return false;

  const levelRank: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 };
  return levelRank[result.permission_level] >= levelRank[requiredLevel];
}

/**
 * Seed default permissions from PROTECTED_ROUTES (for initial setup)
 */
export async function seedDefaultPermissions(
  db: D1Database,
  routes: { path: string; allowedRoles: string[] }[]
): Promise<number> {
  let seeded = 0;

  for (const route of routes) {
    for (const role of ['member', 'arb', 'board', 'admin'] as RoleType[]) {
      // Check if already exists
      const existing = await db
        .prepare('SELECT id FROM route_permissions WHERE route_path = ? AND role = ?')
        .bind(route.path, role)
        .first();

      if (!existing) {
        // Set default permission: write if in allowedRoles, else none
        const level: PermissionLevel = route.allowedRoles.includes(role) ? 'write' : 'none';

        await db
          .prepare(
            `INSERT INTO route_permissions (route_path, role, permission_level, updated_by)
             VALUES (?, ?, ?, 'system')`
          )
          .bind(route.path, role, level)
          .run();

        seeded++;
      }
    }
  }

  return seeded;
}
