/**
 * Route Guards for Astro Pages
 *
 * Server-side permission guards for protecting routes.
 * Use in Astro page frontmatter to enforce permission-based access.
 */

import type { AstroGlobal } from 'astro';
import type { PermissionLevel, RoleType } from '../lib/permissions-db';
import { getCurrentUser } from './rbac';
import { hasPermission } from '../lib/permissions-db';
import { PROTECTED_ROUTES } from './rbac';

export interface PermissionCheckResult {
  allowed: boolean;
  currentLevel: PermissionLevel | null;
  requiredLevel: PermissionLevel;
  userRole: string | null;
  path: string;
}

/**
 * Internal helper: Check if role has access to path with required level.
 * Falls back to PROTECTED_ROUTES if database is unavailable.
 *
 * Note: This is a temporary inline version. After PR #49 merges,
 * this can be replaced with import from '@/utils/permissions'.
 */
async function canAccess(
  role: RoleType,
  path: string,
  required: PermissionLevel,
  db?: D1Database
): Promise<boolean> {
  // Normalize role
  const normalizedRole = role.toLowerCase() as RoleType;

  // If database available, use it
  if (db) {
    try {
      return await hasPermission(db, path, normalizedRole, required);
    } catch (err) {
      console.error('Database permission check failed, falling back to static:', err);
    }
  }

  // Fallback to static PROTECTED_ROUTES
  const route = PROTECTED_ROUTES.find((r) => r.path === path);
  if (!route) return false;

  const isAllowed = route.allowedRoles.includes(normalizedRole);
  if (!isAllowed) return false;

  // In static mode, allowed roles have write access
  const levelRank: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 };
  return levelRank.write >= levelRank[required];
}

/**
 * Require specific permission level for current route.
 * Redirects to access-denied page if permission check fails.
 *
 * @param Astro - Astro global object
 * @param requiredLevel - Required permission level (default: 'read')
 * @param redirectTo - Custom redirect path (default: '/portal/access-denied')
 * @returns Response object if unauthorized, null if authorized
 *
 * @example
 * ```astro
 * ---
 * import { requirePermission } from '@/utils/routeGuards';
 *
 * // Require write access
 * const guard = await requirePermission(Astro, 'write');
 * if (guard) return guard;
 * ---
 * <h1>Protected Page</h1>
 * ```
 */
export async function requirePermission(
  Astro: AstroGlobal,
  requiredLevel: PermissionLevel = 'read',
  redirectTo?: string
): Promise<Response | null> {
  const runtime = Astro.locals.runtime;
  const env = runtime?.env;
  const db = env?.DB;
  const path = Astro.url.pathname;

  // Get current user
  const user = await getCurrentUser(Astro);

  if (!user) {
    // Not logged in - redirect to login
    const returnUrl = encodeURIComponent(path);
    return Astro.redirect(`/portal/login?return=${returnUrl}`);
  }

  // Check permission
  const hasAccess = await canAccess(user.effectiveRole as RoleType, path, requiredLevel, db);

  if (!hasAccess) {
    // No access - redirect to access denied with details
    const target = redirectTo || `/portal/access-denied?path=${encodeURIComponent(path)}&required=${requiredLevel}`;
    return Astro.redirect(target);
  }

  // Authorized
  return null;
}

/**
 * Check permission for current route without redirecting.
 * Returns permission check result for custom handling.
 *
 * @param Astro - Astro global object
 * @param requiredLevel - Required permission level (default: 'read')
 * @returns Permission check result with details
 *
 * @example
 * ```astro
 * ---
 * import { checkPermission } from '@/utils/routeGuards';
 *
 * const check = await checkPermission(Astro, 'write');
 * if (!check.allowed) {
 *   // Custom handling
 *   return new Response('Forbidden', { status: 403 });
 * }
 * ---
 * ```
 */
export async function checkPermission(
  Astro: AstroGlobal,
  requiredLevel: PermissionLevel = 'read'
): Promise<PermissionCheckResult> {
  const runtime = Astro.locals.runtime;
  const env = runtime?.env;
  const db = env?.DB;
  const path = Astro.url.pathname;

  const user = await getCurrentUser(Astro);

  if (!user) {
    return {
      allowed: false,
      currentLevel: null,
      requiredLevel,
      userRole: null,
      path,
    };
  }

  const hasAccess = await canAccess(user.effectiveRole as RoleType, path, requiredLevel, db);

  // Try to determine current level (expensive but useful for debugging)
  let currentLevel: PermissionLevel | null = null;
  if (hasAccess) {
    // Has at least the required level
    currentLevel = requiredLevel;

    // Check if they have write (if we only required read)
    if (requiredLevel === 'read') {
      const hasWrite = await canAccess(user.effectiveRole as RoleType, path, 'write', db);
      if (hasWrite) currentLevel = 'write';
    }
  } else {
    // Check if they have read when write was required
    if (requiredLevel === 'write') {
      const hasRead = await canAccess(user.effectiveRole as RoleType, path, 'read', db);
      if (hasRead) currentLevel = 'read';
    } else {
      currentLevel = 'none';
    }
  }

  return {
    allowed: hasAccess,
    currentLevel,
    requiredLevel,
    userRole: user.effectiveRole,
    path,
  };
}

/**
 * Protect route with permission check and return data or redirect.
 * Useful for pages that need to load data only if authorized.
 *
 * @param Astro - Astro global object
 * @param requiredLevel - Required permission level
 * @param getData - Async function to load page data if authorized
 * @returns Data if authorized, Response redirect if not
 *
 * @example
 * ```astro
 * ---
 * import { withPermissionCheck } from '@/utils/routeGuards';
 *
 * const result = await withPermissionCheck(Astro, 'write', async () => {
 *   // Load data only if authorized
 *   const data = await fetchData();
 *   return { data };
 * });
 *
 * if (result instanceof Response) return result;
 * const { data } = result;
 * ---
 * ```
 */
export async function withPermissionCheck<T>(
  Astro: AstroGlobal,
  requiredLevel: PermissionLevel,
  getData: () => Promise<T>
): Promise<T | Response> {
  const guard = await requirePermission(Astro, requiredLevel);
  if (guard) return guard;

  return getData();
}

/**
 * Require write permission for current route.
 * Shorthand for requirePermission(Astro, 'write').
 *
 * @example
 * ```astro
 * ---
 * import { requireWrite } from '@/utils/routeGuards';
 *
 * const guard = await requireWrite(Astro);
 * if (guard) return guard;
 * ---
 * ```
 */
export async function requireWrite(Astro: AstroGlobal): Promise<Response | null> {
  return requirePermission(Astro, 'write');
}

/**
 * Require read permission for current route.
 * Shorthand for requirePermission(Astro, 'read').
 *
 * @example
 * ```astro
 * ---
 * import { requireRead } from '@/utils/routeGuards';
 *
 * const guard = await requireRead(Astro);
 * if (guard) return guard;
 * ---
 * ```
 */
export async function requireRead(Astro: AstroGlobal): Promise<Response | null> {
  return requirePermission(Astro, 'read');
}

/**
 * Check if current user can perform specific action on current route.
 *
 * @param Astro - Astro global object
 * @param action - Action to check ('view', 'create', 'edit', 'delete')
 * @returns true if allowed, false otherwise
 *
 * @example
 * ```astro
 * ---
 * import { canPerformAction } from '@/utils/routeGuards';
 *
 * const canEdit = await canUserPerformAction(Astro, 'edit');
 * const canDelete = await canUserPerformAction(Astro, 'delete');
 * ---
 * {canEdit && <button>Edit</button>}
 * {canDelete && <button>Delete</button>}
 * ```
 */
export async function canUserPerformAction(
  Astro: AstroGlobal,
  action: 'view' | 'create' | 'edit' | 'delete'
): Promise<boolean> {
  const runtime = Astro.locals.runtime;
  const env = runtime?.env;
  const db = env?.DB;
  const path = Astro.url.pathname;

  const user = await getCurrentUser(Astro);
  if (!user) return false;

  const actionToLevel: Record<string, PermissionLevel> = {
    view: 'read',
    create: 'write',
    edit: 'write',
    delete: 'write',
  };

  const required = actionToLevel[action];
  return canAccess(user.effectiveRole as RoleType, path, required, db);
}

/**
 * Get permission details for current user and route.
 * Useful for displaying permission info or debugging.
 *
 * @param Astro - Astro global object
 * @returns Permission details object
 *
 * @example
 * ```astro
 * ---
 * import { getPermissionDetails } from '@/utils/routeGuards';
 *
 * const details = await getPermissionDetails(Astro);
 * ---
 * <div>Role: {details.role}</div>
 * <div>Access: {details.level}</div>
 * ```
 */
export async function getPermissionDetails(Astro: AstroGlobal): Promise<{
  role: string | null;
  path: string;
  level: PermissionLevel | null;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}> {
  const user = await getCurrentUser(Astro);
  const path = Astro.url.pathname;

  if (!user) {
    return {
      role: null,
      path,
      level: null,
      canView: false,
      canEdit: false,
      canDelete: false,
    };
  }

  const canView = await canUserPerformAction(Astro, 'view');
  const canEdit = await canUserPerformAction(Astro, 'edit');
  const canDelete = await canUserPerformAction(Astro, 'delete');

  // Determine level
  let level: PermissionLevel | null = 'none';
  if (canEdit || canDelete) level = 'write';
  else if (canView) level = 'read';

  return {
    role: user.effectiveRole,
    path,
    level,
    canView,
    canEdit,
    canDelete,
  };
}
