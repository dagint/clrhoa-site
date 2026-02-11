/**
 * POST /api/admin/users/resend-setup
 *
 * Resend password setup email to a user who hasn't completed setup.
 *
 * Request Body:
 * - email: User's email address (required)
 *
 * Flow:
 * 1. Validate request (admin only)
 * 2. Check if user exists and is in pending_setup status
 * 3. Invalidate any existing unused tokens
 * 4. Generate new setup token
 * 5. Send password setup email
 * 6. Log audit event
 *
 * Response:
 * - 200: Setup email sent successfully
 * - 400: Invalid request or user not in pending_setup status
 * - 401: Not authenticated
 * - 403: Not authorized (admin only)
 * - 404: User not found
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../lib/auth/middleware';
import { resendSetupToken, sendSetupEmail } from '../../../../lib/auth/setup-tokens';
import { logAuditEvent } from '../../../../lib/audit-log';

interface ResendSetupRequest {
  email: string;
}

export const POST: APIRoute = async (context) => {
  // 1. Check authentication and admin role
  const authResult = await requireRole(context, ['admin'], false);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const db = context.locals.runtime?.env?.DB;
  const resend = context.locals.runtime?.env?.RESEND;

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

  const adminEmail = (authResult.user as any).email;

  try {
    // 2. Parse and validate request body
    let body: ResendSetupRequest;
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

    // Only allow resending for pending_setup users
    if (user.status !== 'pending_setup') {
      return new Response(
        JSON.stringify({
          error: 'User is not pending password setup',
          details: `Current status: ${user.status}. Only users with status 'pending_setup' can receive setup emails.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Invalidate existing tokens and generate new one
    const { token, tokenId, expiresAt } = await resendSetupToken(
      db,
      normalizedEmail,
      adminEmail
    );

    // 5. Send password setup email
    try {
      const siteUrl = context.url.origin;
      await sendSetupEmail(resend, normalizedEmail, token, user.name || undefined, siteUrl);
    } catch (emailError) {
      console.error('Failed to send password setup email:', emailError);

      // Log failed email attempt
      await logAuditEvent(db, {
        eventType: 'setup_email_failed',
        eventCategory: 'administrative',
        userId: adminEmail,
        targetUserId: normalizedEmail,
        action: 'resend_setup_email',
        outcome: 'failure',
        details: {
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
          token_id: tokenId,
        },
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send setup email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Log successful audit event
    await logAuditEvent(db, {
      eventType: 'setup_email_resent',
      eventCategory: 'administrative',
      userId: adminEmail,
      targetUserId: normalizedEmail,
      action: 'resend_setup_email',
      outcome: 'success',
      details: {
        token_id: tokenId,
        expires_at: expiresAt,
      },
    });

    // 7. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password setup email sent successfully',
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
    console.error('Error resending setup email:', error);

    // Log failed attempt
    await logAuditEvent(db, {
      eventType: 'setup_email_resend_failed',
      eventCategory: 'administrative',
      userId: adminEmail,
      action: 'resend_setup_email',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to resend setup email' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
