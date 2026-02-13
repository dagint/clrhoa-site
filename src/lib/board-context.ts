/**
 * Role-based page context helpers: env + session with role-specific access control.
 *
 * These helpers enforce lazy loading and route-level guards for protected routes.
 * Each helper validates the session and required role, returning either context data
 * or a redirect URL. Pages should check for redirect and call Astro.redirect() immediately.
 *
 * Usage pattern:
 * ```typescript
 * const ctx = await getAdminContext(Astro);
 * if ('redirect' in ctx) return Astro.redirect(ctx.redirect);
 * const { env, session, effectiveRole } = ctx;
 * ```
 *
 * Role landing zones (redirect targets):
 * - Admin: /portal/admin
 * - Board: /portal/board
 * - ARB: /portal/arb
 * - Member: /portal/dashboard
 */

import type { SessionPayload } from './auth';
import { getSessionFromCookie, isElevatedRole, getEffectiveRole, isAdminRole, isArbRole } from './auth';
import { ROLE_LANDING } from '../config/navigation';

/** Env shape for role-based pages (after SESSION_SECRET guard). */
export interface RoleEnv {
  SESSION_SECRET?: string;
  DB?: D1Database;
  CLOURHOA_USERS?: KVNamespace;
}

/** Minimal Astro-like context for role-based pages. */
export interface RoleContextAstro {
  request: Request;
  locals: {
    runtime?: { env?: RoleEnv };
    user?: { id: string; email: string; role: string; status: string } | null;
    session?: { id: string; userId: string; expiresAt: Date } | null;
  };
}

export interface RoleContextResult {
  env: RoleEnv;
  session: SessionPayload;
  effectiveRole: string;
}

export type GetRoleContextResult =
  | RoleContextResult
  | { redirect: string };

/**
 * Get env and session for an ADMIN page.
 *
 * Required permissions: effectiveRole === 'admin'
 *
 * Returns redirect URL if:
 * - No session → /portal/login
 * - Session but not admin → redirects to appropriate landing zone based on effectiveRole
 * - Admin whitelist but not elevated → /portal/request-elevated-access
 *
 * Caller should check: if ('redirect' in r) return Astro.redirect(r.redirect);
 */
export async function getAdminContext(astro: RoleContextAstro): Promise<GetRoleContextResult> {
  const env = astro.locals.runtime?.env;
  const user = astro.locals.user;
  const luciaSession = astro.locals.session;

  // Check if user is authenticated via Lucia
  if (!user || !luciaSession) {
    return { redirect: '/portal/login' };
  }

  // Convert Lucia user to SessionPayload format for compatibility
  // TEMPORARY: Auto-elevate all elevated roles until PIM is fully migrated to Lucia
  // TODO: Implement proper PIM elevation flow with Lucia sessions (see schema-sessions-pim.sql)
  const isElevated = ['admin', 'board', 'arb', 'arb_board'].includes(user.role.toLowerCase());
  const session: SessionPayload = {
    email: user.email,
    role: user.role,
    name: null, // Not stored in Lucia user, would need to fetch from owners table
    exp: Math.floor(luciaSession.expiresAt.getTime() / 1000),
    sessionId: luciaSession.id,
    elevated_until: isElevated ? luciaSession.expiresAt.getTime() : undefined,
  };

  const effectiveRole = getEffectiveRole(session);
  const staffRole = session.role?.toLowerCase() ?? '';

  if (!isAdminRole(effectiveRole)) {
    // Redirect to appropriate landing zone based on effective role
    if (effectiveRole === 'board' || effectiveRole === 'arb_board') {
      return { redirect: ROLE_LANDING.board };
    }
    if (effectiveRole === 'arb') {
      return { redirect: ROLE_LANDING.arb };
    }
    // Admin whitelist but not elevated (PIM required)
    if (staffRole === 'admin') {
      return { redirect: `/portal/request-elevated-access?return=${encodeURIComponent('/portal/admin')}` };
    }
    // Not admin, redirect to member dashboard
    return { redirect: ROLE_LANDING.member || '/portal/dashboard' };
  }

  return { env, session, effectiveRole };
}

/**
 * Get env and session for a BOARD page.
 *
 * Required permissions: effectiveRole === 'board' or 'arb_board'
 *
 * Returns redirect URL if:
 * - No session → /portal/login
 * - Session but not board/arb_board → redirects to appropriate landing zone
 * - Board whitelist but not elevated → /portal/request-elevated-access
 *
 * Caller should check: if ('redirect' in r) return Astro.redirect(r.redirect);
 */
export async function getBoardContext(astro: RoleContextAstro): Promise<GetRoleContextResult> {
  const env = astro.locals.runtime?.env;
  const user = astro.locals.user;
  const luciaSession = astro.locals.session;

  // Check if user is authenticated via Lucia
  if (!user || !luciaSession) {
    return { redirect: '/portal/login' };
  }

  // Convert Lucia user to SessionPayload format for compatibility
  // TEMPORARY: Auto-elevate all elevated roles until PIM is fully migrated to Lucia
  // TODO: Implement proper PIM elevation flow with Lucia sessions (see schema-sessions-pim.sql)
  const isElevated = ['admin', 'board', 'arb', 'arb_board'].includes(user.role.toLowerCase());
  const session: SessionPayload = {
    email: user.email,
    role: user.role,
    name: null, // Not stored in Lucia user, would need to fetch from owners table
    exp: Math.floor(luciaSession.expiresAt.getTime() / 1000),
    sessionId: luciaSession.id,
    elevated_until: isElevated ? luciaSession.expiresAt.getTime() : undefined,
  };

  const effectiveRole = getEffectiveRole(session);
  const staffRole = session.role?.toLowerCase() ?? '';

  if (effectiveRole !== 'board' && effectiveRole !== 'arb_board') {
    // Redirect to appropriate landing zone
    if (effectiveRole === 'admin') {
      return { redirect: ROLE_LANDING.admin };
    }
    if (effectiveRole === 'arb') {
      return { redirect: ROLE_LANDING.arb };
    }
    // Board/arb_board whitelist but not elevated (PIM required)
    if (staffRole === 'board' || staffRole === 'arb_board') {
      return { redirect: `/portal/request-elevated-access?return=${encodeURIComponent('/portal/board')}` };
    }
    // Not board, redirect to member dashboard
    return { redirect: ROLE_LANDING.member || '/portal/dashboard' };
  }

  return { env, session, effectiveRole };
}

/**
 * Get env and session for an ARB page.
 *
 * Required permissions: effectiveRole === 'arb' or 'arb_board'
 *
 * Returns redirect URL if:
 * - No session → /portal/login
 * - Session but not arb/arb_board → redirects to appropriate landing zone
 * - ARB whitelist but not elevated → /portal/request-elevated-access
 *
 * Caller should check: if ('redirect' in r) return Astro.redirect(r.redirect);
 */
export async function getArbContext(astro: RoleContextAstro): Promise<GetRoleContextResult> {
  const env = astro.locals.runtime?.env;
  const user = astro.locals.user;
  const luciaSession = astro.locals.session;

  // Check if user is authenticated via Lucia
  if (!user || !luciaSession) {
    return { redirect: '/portal/login' };
  }

  // Convert Lucia user to SessionPayload format for compatibility
  // TEMPORARY: Auto-elevate all elevated roles until PIM is fully migrated to Lucia
  // TODO: Implement proper PIM elevation flow with Lucia sessions (see schema-sessions-pim.sql)
  const isElevated = ['admin', 'board', 'arb', 'arb_board'].includes(user.role.toLowerCase());
  const session: SessionPayload = {
    email: user.email,
    role: user.role,
    name: null, // Not stored in Lucia user, would need to fetch from owners table
    exp: Math.floor(luciaSession.expiresAt.getTime() / 1000),
    sessionId: luciaSession.id,
    elevated_until: isElevated ? luciaSession.expiresAt.getTime() : undefined,
  };

  const effectiveRole = getEffectiveRole(session);
  const staffRole = session.role?.toLowerCase() ?? '';

  if (!isArbRole(effectiveRole) && effectiveRole !== 'arb_board') {
    // Redirect to appropriate landing zone
    if (effectiveRole === 'admin') {
      return { redirect: ROLE_LANDING.admin };
    }
    if (effectiveRole === 'board') {
      return { redirect: ROLE_LANDING.board };
    }
    // ARB/arb_board whitelist but not elevated (PIM required)
    if (staffRole === 'arb' || staffRole === 'arb_board') {
      return { redirect: `/portal/request-elevated-access?return=${encodeURIComponent('/portal/arb')}` };
    }
    // Not ARB, redirect to member dashboard
    return { redirect: ROLE_LANDING.member || '/portal/dashboard' };
  }

  return { env, session, effectiveRole };
}
