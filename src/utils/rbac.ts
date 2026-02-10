/**
 * RBAC utility functions for route protection and role-based rendering.
 * Used in Astro page frontmatter to check permissions and redirect unauthorized users.
 */

import type { AstroGlobal } from 'astro';
import { getSessionFromCookie, getEffectiveRole, isElevatedRole, isAdminRole, isBoardOnly, isArbRole } from '../lib/auth';

export type Role = 'member' | 'admin' | 'board' | 'arb' | 'arb_board';

/**
 * Get the current user and their effective role from Astro context.
 * Returns null if no session exists.
 */
export async function getCurrentUser(Astro: AstroGlobal): Promise<{ email: string; role: string; name: string | null; effectiveRole: string } | null> {
  const env = Astro.locals.runtime?.env;
  if (!env?.SESSION_SECRET) return null;

  const cookieHeader = Astro.request.headers.get('cookie') ?? undefined;
  const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);

  if (!session) return null;

  const effectiveRole = getEffectiveRole(session);

  return {
    email: session.email,
    role: session.role,
    name: session.name,
    effectiveRole,
  };
}

/**
 * Check if the current user has any of the allowed roles.
 * Redirects to appropriate landing zone if not authorized.
 *
 * Usage in page frontmatter:
 * ```astro
 * ---
 * import { requireRoles } from '@/utils/rbac';
 * const redirectResponse = await requireRoles(Astro, ['admin']);
 * if (redirectResponse) return redirectResponse;
 * ---
 * ```
 */
export async function requireRoles(Astro: AstroGlobal, allowedRoles: Role[]): Promise<Response | null> {
  const user = await getCurrentUser(Astro);

  if (!user) {
    return Astro.redirect('/portal/login');
  }

  if (!allowedRoles.includes(user.effectiveRole as Role)) {
    // Redirect to appropriate landing zone based on their actual role
    const effectiveRole = user.effectiveRole;

    if (effectiveRole === 'admin') {
      return Astro.redirect('/portal/admin');
    } else if (effectiveRole === 'board' || effectiveRole === 'arb_board') {
      return Astro.redirect('/portal/board');
    } else if (effectiveRole === 'arb') {
      return Astro.redirect('/portal/arb');
    }

    return Astro.redirect('/portal/dashboard');
  }

  return null;
}

/**
 * Check if the current user is an admin (effective role).
 */
export async function isCurrentUserAdmin(Astro: AstroGlobal): Promise<boolean> {
  const user = await getCurrentUser(Astro);
  return user ? isAdminRole(user.effectiveRole) : false;
}

/**
 * Check if the current user is board (effective role).
 */
export async function isCurrentUserBoard(Astro: AstroGlobal): Promise<boolean> {
  const user = await getCurrentUser(Astro);
  return user ? isBoardOnly(user.effectiveRole) : false;
}

/**
 * Check if the current user is ARB (effective role).
 */
export async function isCurrentUserArb(Astro: AstroGlobal): Promise<boolean> {
  const user = await getCurrentUser(Astro);
  return user ? isArbRole(user.effectiveRole) : false;
}

/**
 * Check if the current user has elevated access (any elevated role).
 */
export async function isCurrentUserElevated(Astro: AstroGlobal): Promise<boolean> {
  const user = await getCurrentUser(Astro);
  return user ? isElevatedRole(user.effectiveRole) : false;
}

/**
 * Role display labels for UI.
 */
export const ROLE_LABELS: Record<Role, string> = {
  member: 'Member',
  admin: 'Administrator',
  board: 'Board Member',
  arb: 'ARB Committee',
  arb_board: 'Board & ARB',
};

/**
 * Role landing zones (where to redirect after role elevation).
 */
export const ROLE_LANDING_ZONES: Record<Role, string> = {
  member: '/portal/dashboard',
  admin: '/portal/admin',
  board: '/portal/board',
  arb: '/portal/arb',
  arb_board: '/portal/board',
};

/**
 * Get the landing zone URL for a given role.
 */
export function getLandingZone(role: string): string {
  return ROLE_LANDING_ZONES[role as Role] ?? '/portal/dashboard';
}

/**
 * Route metadata type for documentation and route mapping.
 */
export interface RouteMetadata {
  path: string;
  allowedRoles: Role[];
  description: string;
  component?: string;
}

/**
 * All protected routes in the portal with their allowed roles.
 * Used for route map documentation and automated testing.
 */
export const PROTECTED_ROUTES: RouteMetadata[] = [
  // Member routes (all authenticated users)
  { path: '/portal/dashboard', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Member dashboard home' },
  { path: '/portal/directory', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'HOA member directory' },
  { path: '/portal/documents', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Protected member documents' },
  { path: '/portal/profile', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'User profile and preferences' },
  { path: '/portal/requests', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'ARB request status overview' },
  { path: '/portal/my-requests', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'My ARB requests' },
  { path: '/portal/arb-request', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Submit new ARB request' },
  { path: '/portal/maintenance', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Common area maintenance schedule' },
  { path: '/portal/meetings', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Meeting calendar and minutes' },
  { path: '/portal/vendors', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Recommended vendor directory' },
  { path: '/portal/library', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Pre-approved ARB materials library' },
  { path: '/portal/assessments', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'HOA dues and payment history' },
  { path: '/portal/feedback', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Submit feedback to the board' },
  { path: '/portal/news', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'HOA news and announcements' },
  { path: '/portal/docs', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Portal documentation' },
  { path: '/portal/faq', allowedRoles: ['member', 'admin', 'board', 'arb', 'arb_board'], description: 'Frequently asked questions' },

  // Admin routes
  { path: '/portal/admin', allowedRoles: ['admin'], description: 'Admin landing zone' },
  { path: '/portal/admin/feedback', allowedRoles: ['admin'], description: 'Site feedback management' },
  { path: '/portal/admin/sms-requests', allowedRoles: ['admin'], description: 'SMS opt-in request management' },
  { path: '/portal/admin/test-email', allowedRoles: ['admin'], description: 'Email delivery testing' },
  { path: '/portal/admin/backups', allowedRoles: ['admin'], description: 'Database backup management' },
  { path: '/portal/admin/usage', allowedRoles: ['admin'], description: 'Site usage analytics' },
  { path: '/portal/admin/audit-logs', allowedRoles: ['admin'], description: 'Security and audit logs' },
  { path: '/portal/admin/vendors', allowedRoles: ['admin'], description: 'Vendor directory management' },
  { path: '/portal/admin/maintenance', allowedRoles: ['admin'], description: 'Maintenance schedule management' },
  { path: '/portal/admin/directory', allowedRoles: ['admin'], description: 'Member directory management (read-only)' },
  { path: '/portal/admin/contacts', allowedRoles: ['admin'], description: 'Board contact management' },
  { path: '/portal/admin/news', allowedRoles: ['admin'], description: 'News article management' },
  { path: '/portal/admin/member-documents', allowedRoles: ['admin'], description: 'Member document management' },
  { path: '/portal/admin/public-documents', allowedRoles: ['admin'], description: 'Public document management' },

  // Board routes
  { path: '/portal/board', allowedRoles: ['board', 'arb_board'], description: 'Board landing zone' },
  { path: '/board/directory', allowedRoles: ['board', 'arb_board'], description: 'Member directory (full access)' },
  { path: '/board/assessments', allowedRoles: ['board'], description: 'Dues payment tracking and recording' },
  { path: '/board/vendors', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Vendor management and approvals' },
  { path: '/board/meetings', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Meeting management and minutes' },
  { path: '/board/maintenance', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Maintenance request tracking' },
  { path: '/board/feedback', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Member feedback review' },
  { path: '/board/contacts', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Board contact management' },
  { path: '/board/news', allowedRoles: ['board', 'arb', 'arb_board'], description: 'News publishing' },
  { path: '/board/library', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Pre-approval library management' },
  { path: '/board/public-documents', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Public document uploads' },
  { path: '/board/member-documents', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Member document uploads' },
  { path: '/board/audit-logs', allowedRoles: ['board'], description: 'Audit log review' },
  { path: '/board/backups', allowedRoles: ['board', 'arb', 'arb_board'], description: 'Database backups' },

  // ARB routes
  { path: '/portal/arb', allowedRoles: ['arb', 'arb_board'], description: 'ARB landing zone' },
  { path: '/portal/arb-dashboard', allowedRoles: ['arb', 'arb_board', 'board'], description: 'ARB request review dashboard' },
];

/**
 * Get route metadata for a given path.
 */
export function getRouteMetadata(path: string): RouteMetadata | undefined {
  return PROTECTED_ROUTES.find(route => route.path === path);
}

/**
 * Check if a role can access a given route.
 */
export function canAccessRoute(role: Role, path: string): boolean {
  const route = getRouteMetadata(path);
  if (!route) return false;
  return route.allowedRoles.includes(role);
}
