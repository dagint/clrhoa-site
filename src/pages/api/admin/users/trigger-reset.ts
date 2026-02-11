/**
 * POST /api/admin/users/trigger-reset
 *
 * Admin-triggered password reset for any user.
 * Generates a password reset token and sends reset email.
 *
 * Request Body:
 * - email: User's email address (required)
 *
 * Flow:
 * 1. Validate request (admin only)
 * 2. Check if user exists
 * 3. Check user is in active or inactive status (not pending_setup)
 * 4. Generate password reset token
 * 5. Send password reset email
 * 6. Log audit event
 *
 * Response:
 * - 200: Reset email sent successfully
 * - 400: Invalid request or user in pending_setup status
 * - 401: Not authenticated
 * - 403: Not authorized (admin only)
 * - 404: User not found
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../lib/auth/middleware';
import { generateResetToken, sendResetEmail } from '../../../../lib/auth/reset-tokens';
import { logAuditEvent } from '../../../../lib/audit-log';
import { getUserEmail } from '../../../../types/auth';
import type { ResendClient } from '../../../../types/resend';

interface TriggerResetRequest {
  email: string;
}

export const POST: APIRoute = async (context) => {
  // 1. Check authentication and admin role
  const authResult = await requireRole(context, ['admin'], false);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const db = context.locals.runtime?.env?.DB;
  const resend = context.locals.runtime?.env?.RESEND as ResendClient | undefined;

  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database not available' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!resend) {
    return new Response(
      JSON.stringify({ error: 'Email service not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const adminEmail = getUserEmail(authResult.user) || 'unknown';
  const ipAddress =
    context.request.headers.get('CF-Connecting-IP') ||
    context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';
  const userAgent = context.request.headers.get('User-Agent') || 'unknown';

  try {
    // 2. Parse and validate request body
    let body: TriggerResetRequest;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Check if user exists and get current status
    const user = await db
      .prepare(
        `SELECT
          email,
          name,
          status
        FROM users
        WHERE email = ?`
      )
      .bind(normalizedEmail)
      .first<{
        email: string;
        name: string | null;
        status: string;
      }>();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Only allow password reset for users who have completed setup
    // Users in pending_setup status should use resend-setup instead
    if (user.status === 'pending_setup') {
      return new Response(
        JSON.stringify({
          error: 'Cannot reset password for users pending setup',
          details:
            'This user has not completed initial password setup. Use the "Resend Setup Email" option instead.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Generate password reset token
    const { token, tokenId, expiresAt } = await generateResetToken(
      db,
      normalizedEmail,
      ipAddress,
      userAgent
    );

    // 5. Send password reset email
    try {
      const siteUrl = context.url.origin;
      await sendResetEmail(resend, normalizedEmail, token, user.name || undefined, siteUrl);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);

      // Log failed email attempt
      await logAuditEvent(db, {
        eventType: 'admin_reset_email_failed',
        eventCategory: 'administrative',
        userId: adminEmail,
        targetUserId: normalizedEmail,
        action: 'trigger_password_reset',
        outcome: 'failure',
        details: {
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
          token_id: tokenId,
        },
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send reset email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Log successful audit event
    await logAuditEvent(db, {
      eventType: 'admin_triggered_password_reset',
      eventCategory: 'administrative',
      userId: adminEmail,
      targetUserId: normalizedEmail,
      action: 'trigger_password_reset',
      outcome: 'success',
      details: {
        token_id: tokenId,
        expires_at: expiresAt,
        user_status: user.status,
      },
    });

    // 7. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset email sent successfully',
        user: {
          email: normalizedEmail,
          name: user.name,
        },
        token: {
          expiresAt,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error triggering password reset:', error);

    // Log failed attempt
    await logAuditEvent(db, {
      eventType: 'admin_reset_trigger_failed',
      eventCategory: 'administrative',
      userId: adminEmail,
      action: 'trigger_password_reset',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to trigger password reset' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
