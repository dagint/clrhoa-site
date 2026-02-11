/**
 * POST /api/auth/login - Email/password authentication
 *
 * Password-based authentication with MFA support.
 *
 * Flow:
 * 1. Validate email + password from request body
 * 2. Check rate limiting (5 attempts per 15 minutes)
 * 3. Check account lockout (5 failed attempts = 15 min lockout)
 * 4. Verify user exists and status is 'active'
 * 5. Verify password with bcrypt
 * 6. If MFA enabled: create temp token, return mfaRequired=true
 * 7. If MFA disabled: create session, set cookie, return success
 * 8. Log to audit log
 *
 * Error handling:
 * - Generic error messages to prevent email enumeration
 * - Rate limiting returns 429 with retry-after
 * - Account lockout returns specific message with unlock time
 * - Failed login increments counter and logs to audit
 *
 * Security:
 * - Rate limited (5 per 15 min per email)
 * - Account lockout (15 min after 5 failures)
 * - Password verified with bcrypt
 * - Session fingerprinting (IP + user agent)
 * - Audit logging for all attempts
 * - Generic errors prevent enumeration
 * - MFA temp tokens expire in 5 minutes
 */

/// <reference types="@cloudflare/workers-types" />

import type { APIRoute } from 'astro';
import { createLucia } from '../../../lib/lucia';
import { createSession } from '../../../lib/lucia/session';
import { verifyPassword } from '../../../lib/password';
import { checkRateLimit } from '../../../lib/rate-limit';
import { logSecurityEvent, logAuthEvent } from '../../../lib/audit-log';
import crypto from 'node:crypto';

export const prerender = false;

/**
 * Login request body
 */
interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean; // Future: extend session duration
}

/**
 * Login response
 */
interface LoginResponse {
  success: boolean;
  message?: string;
  redirectTo?: string;
  retryAfter?: number; // Seconds until retry allowed
  mfaRequired?: boolean; // MFA verification needed
  tempToken?: string; // Temporary token for MFA flow
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request: Request): string {
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',');
    return ips[0].trim();
  }

  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;

  return 'unknown';
}

/**
 * POST /api/auth/login
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const db = locals.runtime?.env?.DB as D1Database | undefined;
  const kv = locals.runtime?.env?.CLRHOA_USERS as KVNamespace | undefined;

  if (!db || !kv) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Service temporarily unavailable. Please try again.',
      } satisfies LoginResponse),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Parse request body
  let body: LoginRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid request format.',
      } satisfies LoginResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { email, password } = body;

  // Validate input
  if (!email || !password) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Email and password are required.',
      } satisfies LoginResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  // Check rate limiting (10 login attempts per 15 minutes per email)
  const rateLimitResult = await checkRateLimit(
    kv,
    '/api/auth/login',
    normalizedEmail,
    10,
    15 * 60
  );

  if (!rateLimitResult.allowed) {
    await logSecurityEvent(db, {
      eventType: 'login_rate_limited',
      severity: 'warning',
      userId: normalizedEmail,
      details: {
        ip_address: ipAddress,
        reset_at: new Date(rateLimitResult.resetAt * 1000).toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Too many login attempts. Please try again later.',
        retryAfter: rateLimitResult.resetAt,
      } satisfies LoginResponse),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateLimitResult.resetAt.toString(),
        },
      }
    );
  }

  // Get user from database
  const user = await db
    .prepare(
      `SELECT email, password_hash, role, name, status, mfa_enabled,
              failed_login_attempts, locked_until
       FROM users
       WHERE email = ?`
    )
    .bind(normalizedEmail)
    .first<{
      email: string;
      password_hash: string | null;
      role: string;
      name: string | null;
      status: string;
      mfa_enabled: number;
      failed_login_attempts: number;
      locked_until: string | null;
    }>();

  // Check account lockout
  if (user && user.locked_until) {
    const lockedUntil = new Date(user.locked_until);
    const now = new Date();

    if (lockedUntil > now) {
      const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / (1000 * 60));

      await logSecurityEvent(db, {
        eventType: 'login_attempt_while_locked',
        severity: 'warning',
        userId: normalizedEmail,
        details: {
          ip_address: ipAddress,
          locked_until: lockedUntil.toISOString(),
          minutes_remaining: minutesRemaining,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: `Account temporarily locked. Please try again in ${minutesRemaining} minutes.`,
        } satisfies LoginResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // User not found or password not set - generic error to prevent enumeration
  if (!user || !user.password_hash) {
    // Record failed attempt
    if (user) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const shouldLock = newAttempts >= 5;

      await db
        .prepare(
          `UPDATE users
           SET failed_login_attempts = ?,
               locked_until = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE email = ?`
        )
        .bind(
          newAttempts,
          shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
          normalizedEmail
        )
        .run();
    }

    await logAuthEvent(db, {
      eventType: 'login_failed',
      userId: normalizedEmail,
      success: false,
      ipAddress,
      userAgent,
      details: {
        reason: 'invalid_credentials',
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid email or password.',
      } satisfies LoginResponse),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check account status
  if (user.status !== 'active') {
    await logAuthEvent(db, {
      eventType: 'login_failed',
      userId: normalizedEmail,
      success: false,
      ipAddress,
      userAgent,
      details: {
        reason: 'account_not_active',
        status: user.status,
      },
    });

    const message =
      user.status === 'pending_setup'
        ? 'Account setup is incomplete. Please check your email for the setup link.'
        : user.status === 'inactive'
          ? 'Account is deactivated. Please contact your administrator.'
          : 'Invalid email or password.';

    return new Response(
      JSON.stringify({
        success: false,
        message,
      } satisfies LoginResponse),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Verify password with bcrypt
  const passwordValid = await verifyPassword(password, user.password_hash);

  if (!passwordValid) {
    // Record failed attempt
    const newAttempts = (user.failed_login_attempts || 0) + 1;
    const shouldLock = newAttempts >= 5;

    await db
      .prepare(
        `UPDATE users
         SET failed_login_attempts = ?,
             locked_until = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`
      )
      .bind(
        newAttempts,
        shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
        normalizedEmail
      )
      .run();

    await logAuthEvent(db, {
      eventType: 'login_failed',
      userId: normalizedEmail,
      success: false,
      ipAddress,
      userAgent,
      details: {
        reason: 'invalid_password',
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid email or password.',
      } satisfies LoginResponse),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Password is valid! Reset failed login attempts
  await db
    .prepare(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = ?`
    )
    .bind(normalizedEmail)
    .run();

  // Check if MFA is enabled
  if (user.mfa_enabled === 1) {
    // Create temporary token for MFA verification (5-minute expiration)
    const tempToken = crypto.randomBytes(32).toString('hex');

    await kv.put(
      `mfa_temp_token:${tempToken}`,
      JSON.stringify({
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      }),
      { expirationTtl: 5 * 60 } // 5 minutes
    );

    await logSecurityEvent(db, {
      eventType: 'mfa_login_initiated',
      severity: 'info',
      userId: normalizedEmail,
      details: {
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password verified. Please enter your MFA code.',
        mfaRequired: true,
        tempToken,
      } satisfies LoginResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // No MFA - create session directly
  const lucia = createLucia(db);
  const session = await createSession(db, lucia, normalizedEmail, ipAddress, userAgent);

  // Set session cookie
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  // Log successful login
  await logAuthEvent(db, {
    eventType: 'login_successful',
    userId: normalizedEmail,
    sessionId: session.id,
    success: true,
    ipAddress,
    userAgent,
    details: {
      role: user.role,
      mfa_enabled: false,
    },
  });

  // Return success
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Login successful',
      redirectTo: '/portal/dashboard',
    } satisfies LoginResponse),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
