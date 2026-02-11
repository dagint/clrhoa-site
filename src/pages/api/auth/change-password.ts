/**
 * POST /api/auth/change-password
 *
 * Change password for authenticated user.
 * User must provide current password for verification.
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Validate current password
 * 3. Validate new password meets requirements
 * 4. Hash new password
 * 5. Update password_hash and password_changed_at
 * 6. Optionally revoke other sessions (not current one)
 * 7. Send confirmation email
 * 8. Log security event
 *
 * Security:
 * - Requires valid session (authenticated users only)
 * - Verifies current password before allowing change
 * - Rate limiting prevents brute force (10 attempts per hour)
 * - Password change is logged to security_events
 * - Confirmation email sent to user
 * - Current session is preserved, optionally revoke other sessions
 *
 * Response:
 * - 200: Password changed successfully
 * - 400: Invalid request (missing fields, weak password, passwords match)
 * - 401: Unauthorized (no session or current password incorrect)
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

import type { APIRoute } from 'astro';
import { hashPassword, verifyPassword } from '../../../lib/password';
import { logSecurityEvent } from '../../../lib/audit-log';
import { checkRateLimit } from '../../../lib/rate-limit';
import { createLucia } from '../../../lib/lucia';
import { getUserByEmail } from '../../../lib/db';
import type { AuthenticatedUser } from '../../../types/auth';
import type { ResendClient } from '../../../types/resend';

// Password validation constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
  revokeOtherSessions?: boolean; // Optional: revoke all other sessions
}

interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Validate password meets security requirements
 */
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be no more than ${MAX_PASSWORD_LENGTH} characters long`,
    };
  }

  return { valid: true };
}

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const db = locals.runtime?.env?.DB as D1Database | undefined;
  const kv = locals.runtime?.env?.CLRHOA_USERS as KVNamespace | undefined;
  const resend = locals.runtime?.env?.RESEND as ResendClient | undefined;
  const session = locals.session;
  const user = locals.user as AuthenticatedUser | null;

  const ipAddress =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  // 1. Verify user is authenticated
  if (!session || !user || !db) {
    return new Response(
      JSON.stringify({ success: false, message: 'Unauthorized. Please log in.' } satisfies ChangePasswordResponse),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. Parse and validate request body
    let body: ChangePasswordRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid request format' } satisfies ChangePasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { currentPassword, newPassword, newPasswordConfirm, revokeOtherSessions = false } = body;

    // Validate required fields
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Current password, new password, and confirmation are required',
        } satisfies ChangePasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate passwords match
    if (newPassword !== newPasswordConfirm) {
      return new Response(
        JSON.stringify({ success: false, message: 'New passwords do not match' } satisfies ChangePasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate new password is different from current
    if (currentPassword === newPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'New password must be different from current password',
        } satisfies ChangePasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: passwordValidation.error || 'Invalid password',
        } satisfies ChangePasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Rate limiting - prevent brute force (10 attempts per hour per user)
    const rateLimitResult = await checkRateLimit(
      kv,
      `/api/auth/change-password:${user.email}`,
      ipAddress,
      10, // max 10 attempts
      60 * 60 // per hour
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'password_change_rate_limit',
        severity: 'warning',
        userId: user.email,
        details: {
          ip_address: ipAddress,
          reset_at: new Date(rateLimitResult.resetAt * 1000).toISOString(),
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Too many password change attempts. Please try again later.',
        } satisfies ChangePasswordResponse),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get user from database (to verify current password)
    const dbUser = await getUserByEmail(db, user.email);
    if (!dbUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'User not found' } satisfies ChangePasswordResponse),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get password_hash from database
    const passwordResult = await db
      .prepare('SELECT password_hash FROM users WHERE email = ?')
      .bind(user.email)
      .first<{ password_hash: string | null }>();

    if (!passwordResult?.password_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No password set. Please use password setup flow.',
        } satisfies ChangePasswordResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, passwordResult.password_hash);
    if (!isCurrentPasswordValid) {
      await logSecurityEvent(db, {
        eventType: 'password_change_invalid_current_password',
        severity: 'warning',
        userId: user.email,
        details: {
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });

      return new Response(
        JSON.stringify({ success: false, message: 'Current password is incorrect' } satisfies ChangePasswordResponse),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // 7. Update password in database
    await db
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             password_changed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`
      )
      .bind(newPasswordHash, user.email)
      .run();

    // 8. Optionally revoke other sessions (not current one)
    if (revokeOtherSessions && session.id) {
      const lucia = createLucia(db);

      // Get all sessions for this user
      const allSessions = await db
        .prepare('SELECT id FROM sessions WHERE user_id = ?')
        .bind(user.email)
        .all<{ id: string }>();

      // Revoke all except current session
      if (allSessions.results) {
        for (const sess of allSessions.results) {
          if (sess.id !== session.id) {
            await lucia.invalidateSession(sess.id);
          }
        }
      }

      await logSecurityEvent(db, {
        eventType: 'other_sessions_revoked',
        severity: 'info',
        userId: user.email,
        details: {
          reason: 'password_change',
          ip_address: ipAddress,
          session_count: allSessions.results?.length || 0,
        },
      });
    }

    // 9. Log successful password change
    await logSecurityEvent(db, {
      eventType: 'password_changed',
      severity: 'info',
      userId: user.email,
      sessionId: session.id,
      details: {
        ip_address: ipAddress,
        user_agent: userAgent,
        revoked_other_sessions: revokeOtherSessions,
      },
    });

    // 10. Send confirmation email (optional but recommended)
    try {
      await resend?.emails?.send({
        from: 'CLRHOA Portal <portal@clrhoa.com>',
        to: user.email,
        subject: 'Your password has been changed',
        html: `
          <p>Hi ${dbUser.name || 'there'},</p>
          <p>Your CLRHOA portal password has been successfully changed.</p>
          <p>If you did not make this change, please contact support immediately at <a href="mailto:support@clrhoa.com">support@clrhoa.com</a>.</p>
          ${revokeOtherSessions ? '<p>For security, all your other active sessions have been logged out.</p>' : ''}
          <p>Thanks,<br>CLRHOA Team</p>
        `,
        text: `Hi ${dbUser.name || 'there'},\n\nYour CLRHOA portal password has been successfully changed.\n\nIf you did not make this change, please contact support immediately at support@clrhoa.com.\n\n${revokeOtherSessions ? 'For security, all your other active sessions have been logged out.\n\n' : ''}Thanks,\nCLRHOA Team`,
      });
    } catch (emailError) {
      // Log but don't fail the request
      console.error('Failed to send password change confirmation email:', emailError);
    }

    // 11. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password changed successfully',
      } satisfies ChangePasswordResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Password change error:', error);

    await logSecurityEvent(db, {
      eventType: 'password_change_error',
      severity: 'critical',
      userId: user?.email,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while changing password. Please try again.',
      } satisfies ChangePasswordResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
