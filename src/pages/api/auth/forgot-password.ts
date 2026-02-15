/**
 * POST /api/auth/forgot-password
 *
 * Self-service password reset request endpoint.
 * Sends a password reset email to the user if their email exists.
 *
 * Flow:
 * 1. Validate email format
 * 2. Check rate limiting (3 requests per hour per email)
 * 3. Look up user by email
 * 4. Generate reset token (if user exists)
 * 5. Send reset email
 * 6. Return generic success message (no email enumeration)
 *
 * Security:
 * - Generic response prevents email enumeration
 * - Rate limiting prevents spam and abuse (3 per hour per email)
 * - Tokens expire after 2 hours
 * - Tokens are cryptographically random (32 bytes)
 * - Tokens are hashed (SHA-256) before storage
 * - All events logged to security_events
 *
 * Response:
 * - 200: Always returns success (even if email doesn't exist)
 * - 400: Invalid request (malformed email)
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

import type { APIRoute } from 'astro';
import { checkRateLimit } from '../../../lib/rate-limit';
import { logSecurityEvent } from '../../../lib/audit-log';
import { generateResetToken, sendResetEmail } from '../../../lib/auth/reset-tokens';
import { getResendClient } from '../../../lib/resend-client';
import crypto from 'node:crypto';
import type { ResendClient } from '../../../types/resend';

/**
 * Simple email validation regex.
 * Not perfect but catches obvious errors.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const kv = locals.runtime?.env?.KV as KVNamespace | undefined;
  const resend = getResendClient(locals.runtime.env);
  const ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // 1. Parse and validate request body
    let body: { email: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email } = body;

    // Validate email format
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Rate limiting - 3 requests per hour per email
    const rateLimitResult = await checkRateLimit(
      kv,
      '/api/auth/forgot-password',
      normalizedEmail, // Rate limit by email, not IP (prevent abuse of specific accounts)
      3, // max 3 requests
      60 * 60 // per hour
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'forgot_password_rate_limit',
        severity: 'warning',
        userId: normalizedEmail,
        details: {
          ip_address: ipAddress,
          reset_at: new Date(rateLimitResult.resetAt * 1000).toISOString(),
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Too many password reset requests. Please try again later.',
          resetAt: rateLimitResult.resetAt,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Look up user by email
    const user = await db
      .prepare(
        `SELECT email, name, status
         FROM users
         WHERE email = ?`
      )
      .bind(normalizedEmail)
      .first<{
        email: string;
        name: string | null;
        status: string;
      }>();

    // IMPORTANT: Always return the same response to prevent email enumeration
    // Attackers should not be able to determine if an email exists or not
    const genericSuccessResponse = new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    // If user doesn't exist, log and return generic success
    if (!user) {
      await logSecurityEvent(db, {
        eventType: 'forgot_password_unknown_email',
        severity: 'info',
        details: {
          email: normalizedEmail,
          ip_address: ipAddress,
        },
      });

      return genericSuccessResponse;
    }

    // 4. Check if user account is active
    // Only send reset emails to active accounts
    if (user.status !== 'active') {
      await logSecurityEvent(db, {
        eventType: 'forgot_password_inactive_account',
        severity: 'warning',
        userId: user.email,
        details: {
          status: user.status,
          ip_address: ipAddress,
        },
      });

      // Still return generic success to prevent status enumeration
      return genericSuccessResponse;
    }

    // 5. Generate reset token
    const { token, tokenId, expiresAt } = await generateResetToken(
      db,
      user.email,
      ipAddress,
      userAgent
    );

    // 6. Send reset email
    if (resend) {
      try {
        await sendResetEmail(
          resend,
          user.email,
          token,
          user.name || undefined
        );

        // Log successful reset request
        await logSecurityEvent(db, {
          eventType: 'forgot_password_email_sent',
          severity: 'info',
          userId: user.email,
          details: {
            token_id: tokenId,
            ip_address: ipAddress,
            user_agent: userAgent,
            expires_at: expiresAt,
          },
        });
      } catch (emailError) {
      // Log email failure but still return success to user
      // (prevents attackers from using email failures to enumerate accounts)
      console.error('Failed to send reset email:', emailError);

      await logSecurityEvent(db, {
        eventType: 'forgot_password_email_failed',
        severity: 'critical',
        userId: user.email,
        details: {
          token_id: tokenId,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
          ip_address: ipAddress,
        },
      });

        // Still return generic success - user won't know email failed
        // Admin monitoring will catch the critical security event
      }
    }

    return genericSuccessResponse;
  } catch (error) {
    console.error('Forgot password error:', error);

    await logSecurityEvent(db, {
      eventType: 'forgot_password_error',
      severity: 'critical',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'An error occurred. Please try again later.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
