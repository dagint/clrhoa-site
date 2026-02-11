/**
 * POST /api/auth/setup-password
 *
 * First-time password setup endpoint for new users.
 *
 * Flow:
 * 1. Validate setup token from URL parameter
 * 2. Check token hasn't expired (48 hours) or been used
 * 3. Validate password strength
 * 4. Hash password and update user record
 * 5. Mark token as used
 * 6. Update user status from 'pending_setup' to 'active'
 * 7. Create session and log user in
 * 8. Log security event
 *
 * Security:
 * - Token must be cryptographically secure (32+ bytes)
 * - Token is hashed before storage (SHA-256)
 * - Tokens expire after 48 hours
 * - Tokens can only be used once
 * - Password must meet minimum strength requirements
 * - Rate limiting prevents brute force token guessing
 *
 * Response:
 * - 200: Password set successfully, session created
 * - 400: Invalid request (missing fields, weak password)
 * - 401: Invalid or expired token
 * - 409: Token already used or user already active
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

import type { APIRoute } from 'astro';
import { hashPassword } from '../../../lib/password';
import { createSession } from '../../../lib/lucia/session';
import { createLucia } from '../../../lib/lucia';
import { logSecurityEvent } from '../../../lib/audit-log';
import { checkRateLimit } from '../../../lib/rate-limit';
import crypto from 'node:crypto';

// Password validation constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

interface SetupPasswordRequest {
  token: string;
  password: string;
  password_confirm: string;
}

/**
 * Hash token for database lookup (same algorithm used for storage)
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

  // Optional: Add additional password strength checks
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  // - At least one special character
  // For now, keeping it simple for user-friendliness

  return { valid: true };
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const db = locals.runtime.env.DB;
  const ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // 1. Parse and validate request body
    let body: SetupPasswordRequest;
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
    const kv = locals.runtime?.env?.CLRHOA_USERS as KVNamespace | undefined;
    const rateLimitResult = await checkRateLimit(
      kv,
      '/api/auth/setup-password',
      ipAddress,
      10, // max 10 attempts
      60 * 60 // per hour
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'password_setup_rate_limit',
        severity: 'warning',
        details: {
          ip_address: ipAddress,
          reset_at: new Date(rateLimitResult.resetAt * 1000).toISOString(),
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Too many password setup attempts. Please try again later.',
          resetAt: rateLimitResult.resetAt,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Hash token and look up in database
    const tokenHash = hashToken(token);

    const setupTokenResult = await db
      .prepare(
        `SELECT
          st.id,
          st.user_id,
          st.expires_at,
          st.used,
          u.email,
          u.status,
          u.password_hash
        FROM password_setup_tokens st
        JOIN users u ON u.id = st.user_id
        WHERE st.token_hash = ?`
      )
      .bind(tokenHash)
      .first<{
        id: string;
        user_id: string;
        expires_at: number;
        used: number;
        email: string;
        status: string;
        password_hash: string | null;
      }>();

    // Generic error message to prevent token enumeration
    const invalidTokenResponse = new Response(
      JSON.stringify({ error: 'Invalid or expired setup link. Please request a new one.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );

    if (!setupTokenResult) {
      await logSecurityEvent(db, {
        eventType: 'password_setup_invalid_token',
        severity: 'warning',
        details: {
          ip_address: ipAddress,
          token_hash: tokenHash.substring(0, 8) + '...', // Log partial hash for debugging
        },
      });
      return invalidTokenResponse;
    }

    // 4. Validate token hasn't been used
    if (setupTokenResult.used === 1) {
      await logSecurityEvent(db, {
        eventType: 'password_setup_token_already_used',
        severity: 'warning',
        userId: setupTokenResult.email,
        details: {
          ip_address: ipAddress,
          token_id: setupTokenResult.id,
        },
      });

      return new Response(
        JSON.stringify({ error: 'This setup link has already been used. Please request a new one.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validate token hasn't expired (48 hours)
    const now = new Date();
    const expiresAt = new Date(setupTokenResult.expires_at);
    if (expiresAt < now) {
      await logSecurityEvent(db, {
        eventType: 'password_setup_token_expired',
        severity: 'info',
        userId: setupTokenResult.email,
        details: {
          ip_address: ipAddress,
          token_id: setupTokenResult.id,
          expired_at: expiresAt.toISOString(),
        },
      });

      return invalidTokenResponse;
    }

    // 6. Check if user is in correct status
    if (setupTokenResult.status !== 'pending_setup') {
      await logSecurityEvent(db, {
        eventType: 'password_setup_invalid_user_status',
        severity: 'warning',
        userId: setupTokenResult.email,
        details: {
          ip_address: ipAddress,
          current_status: setupTokenResult.status,
          expected_status: 'pending_setup',
        },
      });

      return new Response(
        JSON.stringify({ error: 'Your account is not pending setup. Please log in normally.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Hash password
    const passwordHash = await hashPassword(password);

    // 8. Update user record - set password and activate account
    await db
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             status = 'active',
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`
      )
      .bind(passwordHash, setupTokenResult.user_id)
      .run();

    // 9. Mark token as used
    await db
      .prepare(
        `UPDATE password_setup_tokens
         SET used = 1,
             used_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(setupTokenResult.id)
      .run();

    // 10. Create session and log user in automatically
    const lucia = createLucia(db);
    const session = await createSession(
      db,
      lucia,
      setupTokenResult.email,
      ipAddress,
      userAgent
    );

    // 11. Set session cookie
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    // 12. Log successful password setup
    await logSecurityEvent(db, {
      eventType: 'password_setup_successful',
      severity: 'info',
      userId: setupTokenResult.email,
      sessionId: session.id,
      details: {
        ip_address: ipAddress,
        user_agent: userAgent,
        token_id: setupTokenResult.id,
      },
    });

    // 13. Return success response with session info
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password set successfully. Welcome to the portal!',
        user: {
          email: setupTokenResult.email,
        },
        redirectTo: '/portal/dashboard',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Password setup error:', error);

    await logSecurityEvent(db, {
      eventType: 'password_setup_error',
      severity: 'critical',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'An error occurred during password setup. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
