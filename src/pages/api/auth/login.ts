/**
 * POST /api/auth/login - Email/password authentication
 *
 * Replaces the old whitelist-only auth with password-based authentication.
 *
 * Flow:
 * 1. Validate email + password from request body
 * 2. Check rate limiting (5 attempts per 15 minutes)
 * 3. Check account lockout (5 failed attempts = 15 min lockout)
 * 4. Verify user exists and status is 'active'
 * 5. Verify password with bcrypt
 * 6. Create Lucia session
 * 7. Set HttpOnly session cookie
 * 8. Log successful login to audit log
 * 9. Return success with redirect to dashboard
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
 */

/// <reference types="@cloudflare/workers-types" />

import type { APIRoute } from 'astro';
import { createLucia } from '../../../lib/lucia';
import { createSession } from '../../../lib/auth-session';
import { verifyPassword } from '../../../lib/password';
import { checkAccountLockout, recordFailedLoginAttempt, resetFailedLoginAttempts } from '../../../lib/security-utils';
import { checkRateLimit } from '../../../lib/rate-limiter';
import { RateLimitType } from '../../../lib/rate-limiter';
import { logSecurityEvent } from '../../../lib/audit-log';

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
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request: Request): string | null {
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',');
    return ips[0].trim();
  }

  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;

  return null;
}

/**
 * POST /api/auth/login
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const db = locals.runtime?.env?.DB as D1Database | undefined;

  if (!db) {
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

  const { email, password, remember } = body;

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
  const userAgent = request.headers.get('User-Agent');

  // Check rate limiting (5 login attempts per 15 minutes per email)
  const rateLimitResult = await checkRateLimit(db, {
    type: RateLimitType.LOGIN,
    identifier: normalizedEmail,
    ipAddress,
    userAgent,
  });

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.retryAfter || 15 * 60 * 1000) / 1000);

    await logSecurityEvent(db, {
      eventType: 'login_rate_limited',
      severity: 'warning',
      userId: normalizedEmail,
      ipAddress,
      userAgent,
      details: {
        attempts: rateLimitResult.currentAttempts,
        retryAfter,
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        retryAfter,
      } satisfies LoginResponse),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  // Check account lockout (from security-utils)
  const lockoutStatus = await checkAccountLockout(db, normalizedEmail);

  if (lockoutStatus.isLocked && lockoutStatus.lockedUntil) {
    const now = new Date();
    const lockedUntil = new Date(lockoutStatus.lockedUntil);
    const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / (1000 * 60));

    await logSecurityEvent(db, {
      eventType: 'login_attempt_while_locked',
      severity: 'warning',
      userId: normalizedEmail,
      ipAddress,
      userAgent,
      details: {
        lockedUntil: lockedUntil.toISOString(),
        minutesRemaining,
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: `Account temporarily locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minutes.`,
        retryAfter: minutesRemaining * 60,
      } satisfies LoginResponse),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': (minutesRemaining * 60).toString(),
        },
      }
    );
  }

  // Get user from database
  const user = await db
    .prepare(
      `SELECT email, password_hash, role, name, status, mfa_enabled
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
    }>();

  // User not found or password not set - generic error to prevent enumeration
  if (!user || !user.password_hash) {
    // Record failed attempt to trigger lockout if needed
    await recordFailedLoginAttempt(db, normalizedEmail, ipAddress, userAgent);

    await logSecurityEvent(db, {
      eventType: 'login_failed',
      severity: 'warning',
      userId: normalizedEmail,
      ipAddress,
      userAgent,
      details: {
        reason: 'user_not_found_or_no_password',
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
    await recordFailedLoginAttempt(db, normalizedEmail, ipAddress, userAgent);

    await logSecurityEvent(db, {
      eventType: 'login_failed',
      severity: 'warning',
      userId: normalizedEmail,
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
    await recordFailedLoginAttempt(db, normalizedEmail, ipAddress, userAgent);

    await logSecurityEvent(db, {
      eventType: 'login_failed',
      severity: 'warning',
      userId: normalizedEmail,
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
  await resetFailedLoginAttempts(db, normalizedEmail);

  // Check if MFA is enabled (will be handled in future PR)
  if (user.mfa_enabled === 1) {
    // TODO: PR #16 - Redirect to MFA verification page
    // For now, return error
    return new Response(
      JSON.stringify({
        success: false,
        message: 'MFA verification not yet implemented. Please contact administrator.',
      } satisfies LoginResponse),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create Lucia session
  const lucia = createLucia(db);
  const session = await createSession(db, lucia, normalizedEmail, ipAddress, userAgent);

  // Set session cookie
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  // Log successful login
  await logSecurityEvent(db, {
    eventType: 'login_successful',
    severity: 'info',
    userId: normalizedEmail,
    sessionId: session.id,
    ipAddress,
    userAgent,
    details: {
      role: user.role,
      mfaEnabled: user.mfa_enabled === 1,
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
