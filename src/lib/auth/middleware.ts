/**
 * Auth Middleware Helpers
 *
 * Lucia-based authentication middleware for Astro.
 * Validates sessions, checks roles, and provides user context.
 *
 * Usage in middleware.ts:
 * ```typescript
 * import { validateSession, requireAuth, requireRole } from './lib/auth/middleware';
 *
 * const { session, user } = await validateSession(db, sessionId);
 * if (!session) {
 *   return context.redirect('/auth/login');
 * }
 * ```
 */

import type { APIContext } from 'astro';
import { createLucia } from '../lucia';
import type { Session, User } from 'lucia';
import { getUserRole } from '../../types/auth';

export const SESSION_COOKIE_NAME = 'clrhoa_session';

/**
 * Validate a Lucia session by ID.
 * Returns session and user if valid, null objects if invalid/expired.
 *
 * @param db - D1 database instance
 * @param sessionId - Session ID from cookie
 * @returns Object with session and user (or null if invalid)
 */
export async function validateSession(
  db: D1Database,
  sessionId: string | null | undefined,
  hostname?: string
): Promise<{
  session: Session | null;
  user: User | null;
}> {
  if (!sessionId) {
    return { session: null, user: null };
  }

  try {
    const lucia = createLucia(db, hostname);
    const result = await lucia.validateSession(sessionId);
    return result;
  } catch (error) {
    console.error('Session validation error:', error);
    return { session: null, user: null };
  }
}

/**
 * Get session ID from cookies.
 *
 * @param context - Astro API context
 * @returns Session ID or null
 */
export function getSessionId(context: APIContext): string | null {
  return context.cookies.get(SESSION_COOKIE_NAME)?.value || null;
}

/**
 * Get validated session and user from request context.
 * Convenience wrapper around validateSession.
 *
 * @param context - Astro API context
 * @returns Object with session and user (or null if invalid)
 */
export async function getSession(context: APIContext): Promise<{
  session: Session | null;
  user: User | null;
}> {
  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return { session: null, user: null };
  }

  const sessionId = getSessionId(context);
  const hostname = context.url.hostname;
  return await validateSession(db, sessionId, hostname);
}

/**
 * Require authentication middleware.
 * Redirects to login if no valid session.
 *
 * Usage:
 * ```typescript
 * const authResult = await requireAuth(context);
 * if (authResult.redirect) return authResult.redirect;
 * // authResult.session and authResult.user are guaranteed to be non-null here
 * ```
 *
 * @param context - Astro API context
 * @param redirectTo - Optional redirect URL after login (default: current path)
 * @returns Object with session/user or redirect response
 */
export async function requireAuth(
  context: APIContext,
  redirectTo?: string
): Promise<
  | { session: Session; user: User; redirect: null }
  | { session: null; user: null; redirect: Response }
> {
  const { session, user } = await getSession(context);

  if (!session || !user) {
    const returnPath = redirectTo || context.url.pathname;
    const loginUrl = `/auth/login?return=${encodeURIComponent(returnPath)}`;
    return {
      session: null,
      user: null,
      redirect: context.redirect(loginUrl),
    };
  }

  return { session, user, redirect: null };
}

/**
 * Require specific role(s) middleware.
 * Returns 403 if user doesn't have required role.
 *
 * Usage:
 * ```typescript
 * const roleResult = await requireRole(context, ['admin', 'board']);
 * if (roleResult.redirect) return roleResult.redirect;
 * // User has required role
 * ```
 *
 * @param context - Astro API context
 * @param allowedRoles - Array of allowed role names
 * @param redirectOnFail - Whether to redirect (true) or return 403 (false)
 * @returns Object with session/user or error response
 */
export async function requireRole(
  context: APIContext,
  allowedRoles: string[],
  redirectOnFail: boolean = true
): Promise<
  | { session: Session; user: User; role: string; redirect: null }
  | { session: null; user: null; role: null; redirect: Response }
> {
  const authResult = await requireAuth(context);
  if (authResult.redirect) {
    return { ...authResult, role: null };
  }

  const { session, user } = authResult;
  const userRole = getUserRole(user)?.toLowerCase() || 'member';

  // Normalize allowed roles to lowercase
  const normalizedAllowedRoles = allowedRoles.map((r) => r.toLowerCase());

  if (!normalizedAllowedRoles.includes(userRole)) {
    if (redirectOnFail) {
      // Redirect to appropriate landing zone based on role
      const landingZone = getRoleLandingZone(userRole);
      return {
        session: null,
        user: null,
        role: null,
        redirect: context.redirect(landingZone),
      };
    } else {
      // Return 403 Forbidden for API routes
      return {
        session: null,
        user: null,
        role: null,
        redirect: new Response(
          JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
  }

  return { session, user, role: userRole, redirect: null };
}

/**
 * Get the landing zone (home page) for a given role.
 *
 * @param role - User role
 * @returns Path to role's landing zone
 */
export function getRoleLandingZone(role: string): string {
  const normalized = role?.toLowerCase() || 'member';

  switch (normalized) {
    case 'admin':
      return '/portal/admin';
    case 'board':
    case 'arb_board':
      return '/portal/board';
    case 'arb':
      return '/portal/arb';
    default:
      return '/portal/dashboard';
  }
}

/**
 * Check if a role is elevated (requires special permissions).
 *
 * @param role - User role
 * @returns True if role is elevated (arb, board, arb_board, admin)
 */
export function isElevatedRole(role: string): boolean {
  const normalized = role?.toLowerCase() || '';
  return ['arb', 'board', 'arb_board', 'admin'].includes(normalized);
}

/**
 * Check if a role is admin.
 *
 * @param role - User role
 * @returns True if role is admin
 */
export function isAdminRole(role: string): boolean {
  return role?.toLowerCase() === 'admin';
}

/**
 * Check if a role is board (board or arb_board).
 *
 * @param role - User role
 * @returns True if role is board or arb_board
 */
export function isBoardRole(role: string): boolean {
  const normalized = role?.toLowerCase() || '';
  return normalized === 'board' || normalized === 'arb_board';
}

/**
 * Check if a role is ARB (arb or arb_board).
 *
 * @param role - User role
 * @returns True if role is arb or arb_board
 */
export function isArbRole(role: string): boolean {
  const normalized = role?.toLowerCase() || '';
  return normalized === 'arb' || normalized === 'arb_board';
}

/**
 * Set session cookie in response.
 * Used after login/password setup.
 *
 * @param context - Astro API context
 * @param db - D1 database instance
 * @param sessionId - Session ID to set
 */
export function setSessionCookie(
  context: APIContext,
  db: D1Database,
  sessionId: string
): void {
  const hostname = context.url.hostname;
  const lucia = createLucia(db, hostname);
  const sessionCookie = lucia.createSessionCookie(sessionId);

  context.cookies.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
}

/**
 * Clear session cookie (logout).
 *
 * @param context - Astro API context
 * @param db - D1 database instance
 */
export function clearSessionCookie(context: APIContext, db: D1Database): void {
  const hostname = context.url.hostname;
  const lucia = createLucia(db, hostname);
  const blankCookie = lucia.createBlankSessionCookie();

  context.cookies.set(
    blankCookie.name,
    blankCookie.value,
    blankCookie.attributes
  );
}
