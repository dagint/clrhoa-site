/**
 * POST /api/auth/reset-password
 *
 * Complete password reset with token.
 * User arrives here from email link, provides new password.
 *
 * Flow:
 * 1. Validate token and password
 * 2. Check rate limiting (prevent token brute force)
 * 3. Look up reset token in database
 * 4. Validate token hasn't expired (2 hours) or been used
 * 5. Hash new password
 * 6. Update user password_hash and password_changed_at
 * 7. Mark token as used
 * 8. Revoke all existing sessions (force re-login)
 * 9. Send confirmation email
 * 10. Log security event
 *
 * Security:
 * - Tokens expire after 2 hours (shorter than setup tokens)
 * - Tokens are single-use only
 * - Rate limiting prevents brute force (10 attempts per hour per IP)
 * - All existing sessions are revoked (security best practice)
 * - Password change is logged to security_events
 * - Confirmation email sent to user
 * - Generic error messages prevent token enumeration
 *
 * Response:
 * - 200: Password reset successfully
 * - 400: Invalid request (missing fields, weak password)
 * - 401: Invalid or expired token
 * - 409: Token already used
 * - 429: Rate limit exceeded
 * - 500: Server error
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { hashPassword } from '../../../lib/password';
import { logSecurityEvent } from '../../../lib/audit-log';
import { checkRateLimit } from '../../../lib/rate-limit';
import { getResendClient } from '../../../lib/resend-client';
import { handleDatabaseError, getDatabaseErrorStatus } from '../../../lib/db-errors';
import { createLucia } from '../../../lib/lucia';
import crypto from 'node:crypto';

// Password validation constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

interface ResetPasswordRequest {
  token: string;
  password: string;
  password_confirm: string;
}

/**
 * Hash token for database lookup (SHA-256)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
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

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const kv = locals.runtime?.env?.CLRHOA_USERS as KVNamespace | undefined;
  const resend = getResendClient(locals.runtime.env);
  const ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // 1. Parse and validate request body
    let body: ResetPasswordRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { token, password, password_confirm } = body;

    // Validate required fields
    if (!token || !password || !password_confirm) {
      return new Response(
        JSON.stringify({ error: 'Token, password, and password confirmation are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate passwords match
    if (password !== password_confirm) {
      return new Response(
        JSON.stringify({ error: 'Passwords do not match' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Rate limiting - prevent token brute force (10 attempts per hour per IP)
    const rateLimitResult = await checkRateLimit(
      kv,
      '/api/auth/reset-password',
      ipAddress,
      10, // max 10 attempts
      60 * 60 // per hour
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'password_reset_rate_limit',
        severity: 'warning',
        details: {
          ip_address: ipAddress,
          reset_at: new Date(rateLimitResult.resetAt * 1000).toISOString(),
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Too many password reset attempts. Please try again later.',
          resetAt: rateLimitResult.resetAt,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Hash token and look up in database
    const tokenHash = hashToken(token);

    const resetTokenResult = await db
      .prepare(
        `SELECT
          rt.id,
          rt.user_id,
          rt.expires_at,
          rt.used,
          u.email,
          u.status,
          u.name
        FROM password_reset_tokens rt
        JOIN users u ON u.email = rt.user_id
        WHERE rt.token_hash = ?`
      )
      .bind(tokenHash)
      .first<{
        id: string;
        user_id: string;
        expires_at: string;
        used: number;
        email: string;
        status: string;
        name: string | null;
      }>();

    // Generic error message to prevent token enumeration
    const invalidTokenResponse = new Response(
      JSON.stringify({ error: 'Invalid or expired reset link. Please request a new one.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );

    if (!resetTokenResult) {
      await logSecurityEvent(db, {
        eventType: 'password_reset_invalid_token',
        severity: 'warning',
        details: {
          ip_address: ipAddress,
          token_hash: tokenHash.substring(0, 8) + '...', // Log partial hash for debugging
        },
      });
      return invalidTokenResponse;
    }

    // 4. Validate token hasn't been used
    if (resetTokenResult.used === 1) {
      await logSecurityEvent(db, {
        eventType: 'password_reset_token_already_used',
        severity: 'warning',
        userId: resetTokenResult.email,
        details: {
          ip_address: ipAddress,
          token_id: resetTokenResult.id,
        },
      });

      return new Response(
        JSON.stringify({ error: 'This reset link has already been used. Please request a new one.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validate token hasn't expired (2 hours)
    const now = new Date();
    const expiresAt = new Date(resetTokenResult.expires_at);
    if (expiresAt < now) {
      await logSecurityEvent(db, {
        eventType: 'password_reset_token_expired',
        severity: 'info',
        userId: resetTokenResult.email,
        details: {
          ip_address: ipAddress,
          token_id: resetTokenResult.id,
          expired_at: expiresAt.toISOString(),
        },
      });

      return invalidTokenResponse;
    }

    // 6. Check user account status
    if (resetTokenResult.status !== 'active') {
      await logSecurityEvent(db, {
        eventType: 'password_reset_invalid_user_status',
        severity: 'warning',
        userId: resetTokenResult.email,
        details: {
          ip_address: ipAddress,
          current_status: resetTokenResult.status,
        },
      });

      return new Response(
        JSON.stringify({ error: 'Your account is not active. Please contact support.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Hash new password
    const passwordHash = await hashPassword(password);

    // 8. Update user password and set password_changed_at
    await db
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             password_changed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP,
             failed_login_attempts = 0,
             locked_until = NULL
         WHERE email = ?`
      )
      .bind(passwordHash, resetTokenResult.user_id)
      .run();

    // 9. Mark token as used
    await db
      .prepare(
        `UPDATE password_reset_tokens
         SET used = 1,
             used_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(resetTokenResult.id)
      .run();

    // 10. Revoke all existing sessions for this user (force re-login)
    const hostname = new URL(request.url).hostname;
    const lucia = createLucia(db, hostname);
    await lucia.invalidateUserSessions(resetTokenResult.user_id);

    await logSecurityEvent(db, {
      eventType: 'all_sessions_revoked',
      severity: 'info',
      userId: resetTokenResult.email,
      details: {
        reason: 'password_reset',
        ip_address: ipAddress,
      },
    });

    // 11. Log successful password reset
    await logSecurityEvent(db, {
      eventType: 'password_reset_successful',
      severity: 'info',
      userId: resetTokenResult.email,
      details: {
        ip_address: ipAddress,
        user_agent: userAgent,
        token_id: resetTokenResult.id,
      },
    });

    // 12. Send confirmation email (optional but recommended)
    try {
      await resend?.emails?.send({
        from: 'CLRHOA Portal <portal@clrhoa.com>',
        to: resetTokenResult.email,
        subject: 'Your password has been changed',
        html: `
          <p>Hi ${resetTokenResult.name || 'there'},</p>
          <p>Your CLRHOA portal password has been successfully changed.</p>
          <p>If you did not make this change, please contact support immediately at <a href="mailto:support@clrhoa.com">support@clrhoa.com</a>.</p>
          <p>For security, all your active sessions have been logged out. You'll need to log in again with your new password.</p>
          <p>Thanks,<br>CLRHOA Team</p>
        `,
        text: `Hi ${resetTokenResult.name || 'there'},\n\nYour CLRHOA portal password has been successfully changed.\n\nIf you did not make this change, please contact support immediately at support@clrhoa.com.\n\nFor security, all your active sessions have been logged out. You'll need to log in again with your new password.\n\nThanks,\nCLRHOA Team`,
      });
    } catch (emailError) {
      // Log but don't fail the request
      console.error('Failed to send password change confirmation email:', emailError);
    }

    // 13. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully. You can now log in with your new password.',
        redirectTo: '/auth/login',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Password reset error:', error);

    await logSecurityEvent(db, {
      eventType: 'password_reset_error',
      severity: 'critical',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    // Provide user-friendly error message based on database error type
    const errorMessage = handleDatabaseError(error, 'user');
    const statusCode = getDatabaseErrorStatus(error);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
