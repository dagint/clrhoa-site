/**
 * Admin Authorization Middleware
 *
 * Reusable middleware for protecting admin-only API endpoints.
 * Checks session validity and ensures effective role is 'admin'.
 */

import type { AstroGlobal } from 'astro';
import { getSessionFromCookie, getEffectiveRole } from '../lib/auth';

export interface AdminAuthResult {
  authorized: true;
  session: {
    email: string;
    role: string;
    name: string | null;
    effectiveRole: string;
  };
  env: {
    DB?: D1Database;
    SESSION_SECRET?: string;
    [key: string]: unknown;
  };
}

export interface AdminAuthError {
  authorized: false;
  response: Response;
}

export type AdminAuthCheck = AdminAuthResult | AdminAuthError;

/**
 * Check if the current request has admin authorization.
 *
 * @param Astro - Astro global object
 * @returns AdminAuthResult if authorized, AdminAuthError with response if not
 *
 * @example
 * ```ts
 * const auth = await withAdminAuthorization(Astro);
 * if (!auth.authorized) return auth.response;
 *
 * // Now TypeScript knows auth.session and auth.env exist
 * const { session, env } = auth;
 * ```
 */
export async function withAdminAuthorization(
  Astro: AstroGlobal
): Promise<AdminAuthCheck> {
  const runtime = Astro.locals.runtime;
  const env = runtime?.env;

  // Check session secret
  if (!env?.SESSION_SECRET) {
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  // Get and validate session
  const session = await getSessionFromCookie(
    Astro.request.headers.get('cookie') ?? undefined,
    env.SESSION_SECRET
  );

  if (!session) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }

  // Check admin role
  const effectiveRole = getEffectiveRole(session);
  if (effectiveRole !== 'admin') {
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Admin access required',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  // Authorized
  return {
    authorized: true,
    session: {
      email: session.email,
      role: session.role,
      name: session.name,
      effectiveRole,
    },
    env: env as AdminAuthResult['env'],
  };
}

/**
 * Simpler admin check that just returns boolean.
 *
 * @param Astro - Astro global object
 * @returns true if admin, false otherwise
 *
 * @example
 * ```ts
 * if (!await isAdmin(Astro)) {
 *   return new Response('Forbidden', { status: 403 });
 * }
 * ```
 */
export async function isAdmin(Astro: AstroGlobal): Promise<boolean> {
  const auth = await withAdminAuthorization(Astro);
  return auth.authorized;
}

/**
 * Get admin session or throw error response.
 * Useful for endpoints that always require admin.
 *
 * @param Astro - Astro global object
 * @returns Session and env if authorized
 * @throws Response if not authorized
 *
 * @example
 * ```ts
 * const { session, env } = await requireAdmin(Astro);
 * // TypeScript knows we're authorized here
 * ```
 */
export async function requireAdmin(
  Astro: AstroGlobal
): Promise<{ session: AdminAuthResult['session']; env: AdminAuthResult['env'] }> {
  const auth = await withAdminAuthorization(Astro);

  if (!auth.authorized) {
    throw auth.response;
  }

  return {
    session: auth.session,
    env: auth.env,
  };
}
