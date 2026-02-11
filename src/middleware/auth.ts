/**
 * Authentication Middleware
 *
 * Provides middleware functions for protecting routes based on:
 * - Authentication status (logged in/out)
 * - User roles (member, arb, board, admin)
 * - Elevation status (PIM for sensitive operations)
 *
 * Usage in Astro middleware:
 * ```typescript
 * import { defineMiddleware } from 'astro:middleware';
 * import { attachAuthToContext } from './middleware/auth';
 *
 * export const onRequest = defineMiddleware(async (context, next) => {
 *   await attachAuthToContext(context);
 *   return next();
 * });
 * ```
 *
 * Usage in API routes:
 * ```typescript
 * import { requireAuth, requireRole } from '../../../middleware/auth';
 *
 * export async function POST({ locals }: APIContext) {
 *   requireAuth(locals); // Throws if not authenticated
 *   requireRole(locals, ['admin', 'board']); // Throws if not admin or board
 *
 *   // Route logic here
 * }
 * ```
 */

/// <reference types="@cloudflare/workers-types" />

import type { APIContext } from 'astro';
import type { User, Session } from 'lucia';
import { createLucia } from '../lib/lucia';
import { validateSession } from '../lib/auth-session';

/**
 * Valid user roles in the system
 */
export type UserRole = 'member' | 'arb' | 'board' | 'arb_board' | 'admin';

/**
 * Astro locals augmentation with auth data
 */
export interface AuthLocals {
  user: User | null;
  session: Session | null;
}

/**
 * Get session cookie from request
 *
 * @param context - Astro API context
 * @returns Session ID or null
 */
function getSessionCookie(context: APIContext): string | null {
  const sessionCookie = context.cookies.get('clrhoa_session');
  return sessionCookie?.value || null;
}

/**
 * Get client IP address from request
 *
 * Checks multiple headers in order of preference:
 * 1. CF-Connecting-IP (Cloudflare)
 * 2. X-Forwarded-For (proxy)
 * 3. X-Real-IP (nginx)
 *
 * @param context - Astro API context
 * @returns IP address or null
 */
function getClientIP(context: APIContext): string | null {
  const cfIP = context.request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  const xForwardedFor = context.request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',');
    return ips[0].trim();
  }

  const xRealIP = context.request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;

  return null;
}

/**
 * Get user agent from request
 *
 * @param context - Astro API context
 * @returns User agent string or null
 */
function getUserAgent(context: APIContext): string | null {
  return context.request.headers.get('User-Agent') || null;
}

/**
 * Attach authentication data to Astro context
 *
 * This should be called in Astro middleware to validate sessions
 * and attach user/session to context.locals for use in routes.
 *
 * @param context - Astro API context
 */
export async function attachAuthToContext(context: APIContext): Promise<void> {
  const db = context.locals.runtime?.env?.DB as D1Database | undefined;

  if (!db) {
    console.warn('[auth] Database not available in context');
    context.locals.user = null;
    context.locals.session = null;
    return;
  }

  const lucia = createLucia(db);
  const sessionId = getSessionCookie(context);

  if (!sessionId) {
    context.locals.user = null;
    context.locals.session = null;
    return;
  }

  const ipAddress = getClientIP(context);
  const userAgent = getUserAgent(context);

  const { session, user } = await validateSession(db, lucia, sessionId, ipAddress, userAgent);

  if (session && session.fresh) {
    // Session was extended, set new cookie
    const sessionCookie = lucia.createSessionCookie(session.id);
    context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  }

  if (!session) {
    // Invalid/expired session, clear cookie
    const sessionCookie = lucia.createBlankSessionCookie();
    context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  }

  context.locals.user = user;
  context.locals.session = session;
}

/**
 * Require authentication for a route
 *
 * Throws error if user is not authenticated.
 * Use this in API routes or page components.
 *
 * @param locals - Astro context locals
 * @throws Error if not authenticated
 */
export function requireAuth(locals: AuthLocals): asserts locals is Required<AuthLocals> {
  if (!locals.user || !locals.session) {
    throw new Error('Authentication required');
  }
}

/**
 * Require specific role(s) for a route
 *
 * Throws error if user doesn't have one of the required roles.
 *
 * @param locals - Astro context locals
 * @param roles - Array of allowed roles
 * @throws Error if user doesn't have required role
 */
export function requireRole(locals: AuthLocals, roles: UserRole[]): void {
  requireAuth(locals);

  // After requireAuth, user is guaranteed to be non-null
  const userRole = locals.user!.role as UserRole;

  if (!roles.includes(userRole)) {
    throw new Error(`Insufficient permissions. Required role: ${roles.join(' or ')}`);
  }
}

/**
 * Require admin role
 *
 * Convenience wrapper for requireRole(['admin'])
 *
 * @param locals - Astro context locals
 * @throws Error if user is not admin
 */
export function requireAdmin(locals: AuthLocals): void {
  requireRole(locals, ['admin']);
}

/**
 * Require board or admin role
 *
 * Convenience wrapper for requireRole(['board', 'arb_board', 'admin'])
 *
 * @param locals - Astro context locals
 * @throws Error if user is not board or admin
 */
export function requireBoard(locals: AuthLocals): void {
  requireRole(locals, ['board', 'arb_board', 'admin']);
}

/**
 * Require ARB or admin role
 *
 * Convenience wrapper for requireRole(['arb', 'arb_board', 'admin'])
 *
 * @param locals - Astro context locals
 * @throws Error if user is not ARB or admin
 */
export function requireARB(locals: AuthLocals): void {
  requireRole(locals, ['arb', 'arb_board', 'admin']);
}

/**
 * Check if user is authenticated (without throwing)
 *
 * Use this for optional authentication (e.g., showing different UI)
 *
 * @param locals - Astro context locals
 * @returns True if user is authenticated
 */
export function isAuthenticated(locals: AuthLocals): boolean {
  return Boolean(locals.user && locals.session);
}

/**
 * Check if user has specific role (without throwing)
 *
 * @param locals - Astro context locals
 * @param roles - Array of roles to check
 * @returns True if user has one of the roles
 */
export function hasRole(locals: AuthLocals, roles: UserRole[]): boolean {
  if (!isAuthenticated(locals)) {
    return false;
  }

  const userRole = locals.user!.role as UserRole;
  return roles.includes(userRole);
}

/**
 * Check if user is admin
 *
 * @param locals - Astro context locals
 * @returns True if user is admin
 */
export function isAdmin(locals: AuthLocals): boolean {
  return hasRole(locals, ['admin']);
}

/**
 * Check if user is board member (including arb_board and admin)
 *
 * @param locals - Astro context locals
 * @returns True if user is board, arb_board, or admin
 */
export function isBoard(locals: AuthLocals): boolean {
  return hasRole(locals, ['board', 'arb_board', 'admin']);
}

/**
 * Check if user is ARB member (including arb_board and admin)
 *
 * @param locals - Astro context locals
 * @returns True if user is arb, arb_board, or admin
 */
export function isARB(locals: AuthLocals): boolean {
  return hasRole(locals, ['arb', 'arb_board', 'admin']);
}
