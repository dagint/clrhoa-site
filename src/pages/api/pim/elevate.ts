/**
 * POST /api/pim/elevate
 *
 * Request JIT (Just-In-Time) elevated access.
 * Requires:
 * - Active Lucia session
 * - Elevated role (admin, board, arb, arb_board)
 * - Password re-authentication for security
 *
 * On success, updates session with elevated_until = now + 30 minutes.
 * All elevation requests are logged to pim_elevation_logs table.
 */

import type { APIContext } from 'astro';
import bcrypt from 'bcryptjs';
import { insertPimElevationLog } from '../../../lib/pim-db';

export const prerender = false;

const ELEVATION_DURATION_MS = 60 * 60 * 1000; // 60 minutes

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

  // Parse request body
  let body: { password?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({
      error: 'Invalid request body',
      success: false
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { password } = body;

  // Require password for re-authentication
  if (!password || typeof password !== 'string') {
    return new Response(JSON.stringify({
      error: 'Password is required for elevation',
      success: false
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify password
  try {
    const userRecord = await env.DB
      .prepare('SELECT password_hash FROM users WHERE email = ?')
      .bind(user.email)
      .first<{ password_hash: string }>();

    if (!userRecord || !userRecord.password_hash) {
      return new Response(JSON.stringify({
        error: 'User not found',
        success: false
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const passwordValid = await bcrypt.compare(password, userRecord.password_hash);

    if (!passwordValid) {
      // TODO: Log failed elevation attempt to audit log
      return new Response(JSON.stringify({
        error: 'Invalid password',
        success: false
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Password valid - grant elevation
    const elevatedUntil = Date.now() + ELEVATION_DURATION_MS;

    // Update session with elevation
    await env.DB
      .prepare('UPDATE sessions SET elevated_until = ? WHERE id = ?')
      .bind(elevatedUntil, session.id)
      .run();

    // Log successful elevation
    const expiresAtIso = new Date(elevatedUntil).toISOString();
    await insertPimElevationLog(env.DB, {
      email: user.email,
      role: userRole,
      action: 'elevate',
      expires_at: expiresAtIso,
    });

    return new Response(JSON.stringify({
      success: true,
      elevated_until: elevatedUntil,
      expires_in_minutes: 60,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PIM elevation error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
