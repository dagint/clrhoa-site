/**
 * POST /api/auth/logout - Logout and revoke session
 *
 * Logs out the current user by:
 * 1. Validating session cookie
 * 2. Revoking session in database
 * 3. Invalidating session in Lucia
 * 4. Clearing session cookie
 * 5. Logging logout event to audit log
 *
 * This endpoint can be called multiple times safely (idempotent).
 * If no session exists, it still returns success and clears cookies.
 *
 * Security:
 * - Session revocation is immediate (cannot be reused)
 * - Cookie cleared with same attributes as set
 * - Audit log tracks all logouts
 * - No sensitive data in response
 */

/// <reference types="@cloudflare/workers-types" />

import type { APIRoute } from 'astro';
import { createLucia } from '../../../lib/lucia';
import { revokeSession } from '../../../lib/auth-session';
import { logSecurityEvent } from '../../../lib/audit-log';

export const prerender = false;

/**
 * Logout response
 */
interface LogoutResponse {
  success: boolean;
  message: string;
  redirectTo?: string;
}

/**
 * POST /api/auth/logout
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const db = locals.runtime?.env?.DB as D1Database | undefined;

  if (!db) {
    // Even without DB, clear cookies
    const lucia = createLucia(db!); // Type hack for cookie name
    const blankCookie = lucia.createBlankSessionCookie();
    cookies.set(blankCookie.name, blankCookie.value, blankCookie.attributes);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Logged out successfully',
        redirectTo: '/portal/login',
      } satisfies LogoutResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const lucia = createLucia(db);
  const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || null;
  const userAgent = request.headers.get('User-Agent');

  // Get session ID from cookie
  const sessionCookie = cookies.get('clrhoa_session');
  const sessionId = sessionCookie?.value || null;

  if (sessionId) {
    try {
      // Get user info before revoking (for audit log)
      const sessionData = await db
        .prepare('SELECT user_id FROM sessions WHERE id = ?')
        .bind(sessionId)
        .first<{ user_id: string }>();

      // Revoke session
      await revokeSession(db, lucia, sessionId, 'user', 'manual_logout');

      // Log logout event
      if (sessionData) {
        await logSecurityEvent(db, {
          eventType: 'logout',
          severity: 'info',
          userId: sessionData.user_id,
          sessionId,
          ipAddress,
          userAgent,
          details: {
            reason: 'manual_logout',
          },
        });
      }
    } catch (error) {
      console.error('[auth] Logout error:', error);
      // Continue to clear cookie even if revocation fails
    }
  }

  // Clear session cookie
  const blankCookie = lucia.createBlankSessionCookie();
  cookies.set(blankCookie.name, blankCookie.value, blankCookie.attributes);

  // Return success
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Logged out successfully',
      redirectTo: '/portal/login',
    } satisfies LogoutResponse),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
