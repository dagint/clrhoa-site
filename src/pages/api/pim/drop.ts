/**
 * POST /api/pim/drop
 *
 * Drop JIT (Just-In-Time) elevated access voluntarily.
 * Requires:
 * - Active Lucia session
 * - Currently elevated (has elevated_until set)
 *
 * On success, clears elevated_until from session.
 * All drop requests are logged to pim_elevation_logs table.
 */

import type { APIContext } from 'astro';
import { insertPimElevationLog } from '../../../lib/pim-db';
import { verifyCsrfToken } from '../../../lib/auth';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const env = context.locals.runtime?.env;
  const user = context.locals.user;
  const session = context.locals.session;

  // Check authentication
  if (!user || !session || !env?.DB) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      success: false
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userRole = user.role.toLowerCase();
  const elevatedRoles = ['admin', 'board', 'arb', 'arb_board'];

  // Check if user has elevated role
  if (!elevatedRoles.includes(userRole)) {
    return new Response(JSON.stringify({
      error: 'Your account does not have elevated access privileges',
      success: false
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // CSRF token verification
  let body: { csrf_token?: string; csrfToken?: string };
  try {
    body = await context.request.json();
  } catch {
    // Empty body is OK for drop operation
    body = {};
  }

  if (!verifyCsrfToken(session as any, body.csrf_token ?? body.csrfToken)) {
    return new Response(JSON.stringify({
      error: 'Invalid security token',
      success: false
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get current assumed_role before clearing (for logging)
    const dbSession = await env.DB
      .prepare('SELECT assumed_role FROM sessions WHERE id = ?')
      .bind(session.id)
      .first<{ assumed_role: string | null }>();

    const assumedRole = dbSession?.assumed_role;

    // Clear elevation and assumed role from session
    await env.DB
      .prepare('UPDATE sessions SET elevated_until = NULL, assumed_role = NULL, assumed_at = NULL, assumed_until = NULL WHERE id = ?')
      .bind(session.id)
      .run();

    // Log the drop action with the specific role that was dropped
    const loggedRole = assumedRole || userRole;
    await insertPimElevationLog(env.DB, {
      email: user.email,
      role: loggedRole,
      action: 'drop',
      expires_at: null,
    });

    return new Response(JSON.stringify({
      success: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PIM drop error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
