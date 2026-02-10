/**
 * Role-based access control for board and admin routes.
 * Centralizes the complex nested logic from middleware into a testable function.
 */

export interface RouteAccessConfig {
  /** Paths that require admin or board role */
  auditLogsPaths: string[];
  /** Paths that require board or arb_board role only (not arb or admin) */
  boardOnlyPaths: string[];
  /** Paths that allow board, arb_board, or arb roles */
  arbAllowedPaths: string[];
  /** Paths that admin can access (subset of board paths) */
  adminAllowedBoardPaths: string[];
}

/**
 * Default route access configuration.
 * Exported for testing and potential runtime overrides.
 */
export const DEFAULT_ROUTE_ACCESS: RouteAccessConfig = {
  auditLogsPaths: ['/board/audit-logs'],
  boardOnlyPaths: ['/board/directory', '/board/assessments'],
  arbAllowedPaths: [
    '/board/vendors',
    '/board/meetings',
    '/board/maintenance',
    '/board/feedback',
    '/board/contacts',
    '/board/news',
    '/board/library',
    '/board/member-documents',
    '/board/public-documents',
    '/board/backups',
  ],
  adminAllowedBoardPaths: [
    '/board/audit-logs',
    '/board/backups',
    '/board/vendors',
    '/board/maintenance',
    '/board/directory',
    '/board/contacts',
    '/board/news',
    '/board/member-documents',
    '/board/public-documents',
  ],
};

/**
 * Check if a path matches any of the given patterns.
 * Supports exact match or prefix match with trailing slash.
 */
function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Determine if a role has access to a specific route.
 * Returns true if access is granted, false otherwise.
 *
 * @param role - The user's effective role (string for flexibility with getEffectiveRole)
 * @param pathname - The route path being accessed
 * @param config - Optional custom route access configuration
 * @returns true if access granted, false otherwise
 *
 * @example
 * hasRouteAccess('admin', '/board/audit-logs'); // true
 * hasRouteAccess('arb', '/board/directory'); // false
 * hasRouteAccess('board', '/board/vendors'); // true
 */
export function hasRouteAccess(
  role: string,
  pathname: string,
  config: RouteAccessConfig = DEFAULT_ROUTE_ACCESS
): boolean {
  const isAuditLogs = matchesPath(pathname, config.auditLogsPaths);
  const isBoardOnly = matchesPath(pathname, config.boardOnlyPaths);
  const isArbAllowed = matchesPath(pathname, config.arbAllowedPaths);
  const isAdminAllowedHere = role === 'admin' && matchesPath(pathname, config.adminAllowedBoardPaths);

  // Admin can access specific board routes
  if (isAdminAllowedHere) {
    return true;
  }

  // Audit logs: admin or board only
  if (isAuditLogs) {
    return role === 'admin' || role === 'board';
  }

  // Board-only paths: board or arb_board only
  if (isBoardOnly) {
    return role === 'board' || role === 'arb_board';
  }

  // ARB-allowed paths: board, arb_board, or arb
  if (isArbAllowed) {
    return role === 'board' || role === 'arb_board' || role === 'arb';
  }

  // Default board paths: board or arb_board only
  return role === 'board' || role === 'arb_board';
}

/**
 * Get the appropriate redirect path when access is denied.
 * Returns the landing page for the user's role.
 *
 * @param role - The user's effective role (string for flexibility)
 * @returns Redirect path for the role
 */
export function getAccessDeniedRedirect(role: string): string {
  switch (role) {
    case 'admin':
      return '/portal/admin';
    case 'arb':
    case 'arb_board':
      return '/portal/arb';
    case 'board':
      return '/board';
    case 'member':
    default:
      return '/portal/dashboard';
  }
}
