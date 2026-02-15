/**
 * POST /api/pim/extend
 *
 * Extend JIT (Just-In-Time) elevated access by 45 minutes.
 * Requires:
 * - Active Lucia session
 * - Currently elevated (has elevated_until set and not expired)
 * - Elevated role (admin, board, arb, arb_board)
 *
 * Extension becomes available 15 minutes before expiration.
 * Each extension adds 45 minutes to the current expiration time.
 * All extension requests are logged to pim_elevation_log table.
 */

import type { APIContext } from 'astro';
import { insertPimElevationLog } from '../../../lib/pim-db';

export const prerender = false;

const EXTENSION_DURATION_MS = 45 * 60 * 1000; // 45 minutes
const EXTENSION_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes - can extend when this much time left

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

  try {
    // Get current elevation status
    const dbSession = await env.DB
      .prepare('SELECT elevated_until FROM sessions WHERE id = ?')
      .bind(session.id)
      .first<{ elevated_until: number | null }>();

    if (!dbSession || !dbSession.elevated_until) {
      return new Response(JSON.stringify({
        error: 'You do not have active elevated access',
        success: false
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const currentExpiration = dbSession.elevated_until;

    // Check if elevation has already expired
    if (currentExpiration < now) {
      return new Response(JSON.stringify({
        error: 'Your elevated access has expired. Please request new access.',
        success: false
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is within extension window (15 minutes before expiration)
    const timeRemaining = currentExpiration - now;
    if (timeRemaining > EXTENSION_THRESHOLD_MS) {
      const minutesRemaining = Math.ceil(timeRemaining / 60000);
      return new Response(JSON.stringify({
        error: `Extension not yet available. You can extend when you have 15 minutes or less remaining. (${minutesRemaining} minutes left)`,
        success: false,
        minutes_remaining: minutesRemaining
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Grant extension - add 45 minutes to current expiration
    const newExpiration = currentExpiration + EXTENSION_DURATION_MS;

    // Update session with new expiration
    await env.DB
      .prepare('UPDATE sessions SET elevated_until = ? WHERE id = ?')
      .bind(newExpiration, session.id)
      .run();

    // Log the extension
    const expiresAtIso = new Date(newExpiration).toISOString();
    await insertPimElevationLog(env.DB, {
      email: user.email,
      role: userRole,
      action: 'elevate', // Using 'elevate' to represent extension
      expires_at: expiresAtIso,
    });

    const totalMinutes = Math.ceil((newExpiration - now) / 60000);

    return new Response(JSON.stringify({
      success: true,
      elevated_until: newExpiration,
      total_minutes_remaining: totalMinutes,
      extension_granted_minutes: 45,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PIM extension error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
