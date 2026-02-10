/**
 * Permission Utilities
 *
 * Helper functions for checking and retrieving role-based permissions.
 * Used by route guards, middleware, and API endpoints.
 */

import type { PermissionLevel, RoleType } from '../lib/permissions-db';
import { getRoutePermissions, hasPermission as dbHasPermission } from '../lib/permissions-db';
import { PROTECTED_ROUTES } from './rbac';

/**
 * Check if a role has the required permission level for a given path.
 *
 * @param role - The role to check (member, arb, board, admin)
 * @param path - The route path to check access for
 * @param required - The minimum required permission level (default: 'read')
 * @param db - Optional D1 database instance. If not provided, uses static fallback.
 * @returns Promise<boolean> - True if role has required permission
 *
 * @example
 * ```ts
 * const canView = await canAccess('member', '/portal/dashboard', 'read', db);
 * const canEdit = await canAccess('board', '/board/meetings', 'write', db);
 * ```
 */
export async function canAccess(
  role: RoleType,
  path: string,
  required: PermissionLevel = 'read',
  db?: D1Database
): Promise<boolean> {
  // Normalize role
  const normalizedRole = role.toLowerCase() as RoleType;

  // If database is available, use it
  if (db) {
    try {
      return await dbHasPermission(db, path, normalizedRole, required);
    } catch (err) {
      console.error('Database permission check failed, falling back to static:', err);
    }
  }

  // Fallback to static PROTECTED_ROUTES
  return canAccessStatic(normalizedRole, path, required);
}

/**
 * Static fallback permission check using PROTECTED_ROUTES.
 * Used when database is not available.
 */
function canAccessStatic(
  role: RoleType,
  path: string,
  required: PermissionLevel
): boolean {
  const route = PROTECTED_ROUTES.find((r) => r.path === path);

  if (!route) {
    // Route not found in protected routes - deny by default
    return false;
  }

  // Check if role is in allowedRoles
  const isAllowed = route.allowedRoles.includes(role);

  if (!isAllowed) {
    return false;
  }

  // For static checks, allowed roles have write access
  // If they need write and they're allowed, return true
  // If they need read and they're allowed, return true
  const levelRank: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 };

  // Assume allowed roles have write access in static mode
  return levelRank.write >= levelRank[required];
}

/**
 * Get all permissions for a specific role.
 *
 * @param role - The role to get permissions for
 * @param db - Optional D1 database instance. If not provided, uses static fallback.
 * @returns Promise<Record<string, PermissionLevel>> - Map of path -> permission level
 *
 * @example
 * ```ts
 * const memberPerms = await getRolePermissions('member', db);
 * // { "/portal/dashboard": "write", "/portal/directory": "read", ... }
 * ```
 */
export async function getRolePermissions(
  role: RoleType,
  db?: D1Database
): Promise<Record<string, PermissionLevel>> {
  const normalizedRole = role.toLowerCase() as RoleType;

  // If database is available, query all routes for this role
  if (db) {
    try {
      const allPerms: Record<string, PermissionLevel> = {};

      // Get all unique routes
      const routes = Array.from(new Set(PROTECTED_ROUTES.map((r) => r.path)));

      // Query permissions for each route
      for (const routePath of routes) {
        const perms = await getRoutePermissions(db, routePath);
        if (perms[normalizedRole]) {
          allPerms[routePath] = perms[normalizedRole];
        } else {
          // Default to none if not set
          allPerms[routePath] = 'none';
        }
      }

      return allPerms;
    } catch (err) {
      console.error('Database permission fetch failed, falling back to static:', err);
    }
  }

  // Fallback to static PROTECTED_ROUTES
  return getRolePermissionsStatic(normalizedRole);
}

/**
 * Static fallback for getting role permissions from PROTECTED_ROUTES.
 */
function getRolePermissionsStatic(role: RoleType): Record<string, PermissionLevel> {
  const permissions: Record<string, PermissionLevel> = {};

  for (const route of PROTECTED_ROUTES) {
    if (route.allowedRoles.includes(role)) {
      // Allowed roles get write access in static mode
      permissions[route.path] = 'write';
    } else {
      permissions[route.path] = 'none';
    }
  }

  return permissions;
}

/**
 * Check if a role can perform a specific action on a path.
 *
 * @param role - The role to check
 * @param path - The route path
 * @param action - The action to check ('view', 'create', 'edit', 'delete')
 * @param db - Optional D1 database instance
 * @returns Promise<boolean> - True if role can perform action
 *
 * @example
 * ```ts
 * const canView = await canPerformAction('member', '/portal/dashboard', 'view', db);
 * const canEdit = await canPerformAction('board', '/board/meetings', 'edit', db);
 * ```
 */
export async function canPerformAction(
  role: RoleType,
  path: string,
  action: 'view' | 'create' | 'edit' | 'delete',
  db?: D1Database
): Promise<boolean> {
  // Map actions to permission levels
  const actionToLevel: Record<string, PermissionLevel> = {
    view: 'read',
    create: 'write',
    edit: 'write',
    delete: 'write',
  };

  const required = actionToLevel[action];
  return canAccess(role, path, required, db);
}

/**
 * Get all paths accessible by a role at a given permission level.
 *
 * @param role - The role to check
 * @param minLevel - Minimum permission level required (default: 'read')
 * @param db - Optional D1 database instance
 * @returns Promise<string[]> - Array of accessible paths
 *
 * @example
 * ```ts
 * const readablePaths = await getAccessiblePaths('member', 'read', db);
 * const writablePaths = await getAccessiblePaths('board', 'write', db);
 * ```
 */
export async function getAccessiblePaths(
  role: RoleType,
  minLevel: PermissionLevel = 'read',
  db?: D1Database
): Promise<string[]> {
  const allPerms = await getRolePermissions(role, db);
  const levelRank: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 };

  return Object.entries(allPerms)
    .filter(([_, level]) => levelRank[level] >= levelRank[minLevel])
    .map(([path]) => path);
}

/**
 * Validate permission level value.
 */
export function isValidPermissionLevel(level: string): level is PermissionLevel {
  return level === 'none' || level === 'read' || level === 'write';
}

/**
 * Validate role value.
 */
export function isValidRole(role: string): role is RoleType {
  return role === 'member' || role === 'arb' || role === 'board' || role === 'admin';
}

/**
 * Get permission level name for display.
 */
export function getPermissionLevelLabel(level: PermissionLevel): string {
  const labels: Record<PermissionLevel, string> = {
    none: 'No Access',
    read: 'Read Only',
    write: 'Full Access',
  };
  return labels[level];
}

/**
 * Get role display name.
 */
export function getRoleLabel(role: RoleType): string {
  const labels: Record<RoleType, string> = {
    member: 'Member',
    arb: 'ARB Committee',
    board: 'Board Member',
    admin: 'Administrator',
    arb_board: 'ARB & Board Member',
  };
  return labels[role];
}
