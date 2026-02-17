/**
 * POST /api/admin/send-user-invite
 *
 * Send password setup invitation to directory-only users or resend to pending users.
 * Board/Admin only.
 *
 * Flow:
 * 1. Verify board/admin role
 * 2. Check if user exists in directory (owners table)
 * 3. Create user account if doesn't exist (status: pending_setup)
 * 4. Generate setup token
 * 5. Send setup email
 * 6. Return success
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "csrf_token": "..."
 * }
 *
 * Response:
 * - 200: Invite sent successfully
 * - 400: Invalid request
 * - 403: Forbidden (not board/admin)
 * - 404: Email not found in directory
 * - 500: Server error
 */

import type { APIRoute } from 'astro';
import { verifyCsrfToken, getEffectiveRole, isBoardOnly } from '../../../lib/auth';
import { generateSetupToken, sendSetupEmail, resendSetupToken } from '../../../lib/auth/setup-tokens';
import { getResendClient } from '../../../lib/resend-client';
import { logSecurityEvent } from '../../../lib/audit-log';
import crypto from 'node:crypto';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  const session = locals.session;
  const resend = getResendClient(locals.runtime.env);
  const ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';

  // 1. Auth check
  if (!session || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const effectiveRole = getEffectiveRole(session);
  const isAuthorized = isBoardOnly(effectiveRole) || effectiveRole === 'admin';

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Forbidden - Board/Admin only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Parse request
  let body: { email?: string; csrf_token?: string; csrfToken?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. CSRF check
  if (!verifyCsrfToken(session, body.csrf_token ?? body.csrfToken)) {
    return new Response(JSON.stringify({ error: 'Invalid security token. Please refresh the page.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetEmail = body.email?.trim()?.toLowerCase();
  if (!targetEmail) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 4. Check if email exists in directory
    const directoryEntry = await db
      .prepare('SELECT email, name FROM owners WHERE email = ?')
      .bind(targetEmail)
      .first<{ email: string; name: string | null }>();

    if (!directoryEntry) {
      return new Response(JSON.stringify({ error: 'Email not found in directory' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Check if user account already exists
    const existingUser = await db
      .prepare('SELECT email, status FROM users WHERE email = ?')
      .bind(targetEmail)
      .first<{ email: string; status: string }>();

    let token: string;
    let isNewAccount = false;

    if (!existingUser) {
      // Create new user account with pending_setup status
      // Get role from KV or default to member
      let role = 'member';
      const kv = locals.runtime?.env?.KV as KVNamespace | undefined;
      if (kv) {
        const kvRole = await kv.get(targetEmail);
        if (kvRole && ['member', 'board', 'arb', 'arb_board', 'admin'].includes(kvRole)) {
          role = kvRole;
        }
      }

      const userId = crypto.randomBytes(16).toString('hex');
      await db
        .prepare(
          `INSERT INTO users (id, email, name, role, status, created_at)
           VALUES (?, ?, ?, ?, 'pending_setup', datetime('now'))`
        )
        .bind(userId, targetEmail, directoryEntry.name, role)
        .run();

      isNewAccount = true;

      await logSecurityEvent(db, {
        eventType: 'user_account_created_for_invite',
        severity: 'info',
        userId: targetEmail,
        details: {
          created_by: user.email,
          role,
          ip_address: ipAddress,
        },
      });

      // Generate setup token
      const result = await generateSetupToken(db, targetEmail, user.email);
      token = result.token;
    } else if (existingUser.status === 'pending_setup') {
      // Account exists but hasn't set up password - resend invite
      const result = await resendSetupToken(db, targetEmail, user.email);
      token = result.token;
    } else if (existingUser.status === 'active') {
      return new Response(
        JSON.stringify({ error: 'User already has an active account' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: `Cannot send invite to ${existingUser.status} account` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Send setup email
    if (!resend) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const siteUrl = new URL(request.url).origin;
    await sendSetupEmail(resend, targetEmail, token, directoryEntry.name || undefined, siteUrl);

    await logSecurityEvent(db, {
      eventType: isNewAccount ? 'user_invite_sent' : 'user_invite_resent',
      severity: 'info',
      userId: targetEmail,
      details: {
        sent_by: user.email,
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: isNewAccount ? 'Invite sent successfully' : 'Invite resent successfully',
        isNewAccount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send invite error:', error);

    await logSecurityEvent(db, {
      eventType: 'user_invite_failed',
      severity: 'critical',
      details: {
        email: targetEmail,
        sent_by: user.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to send invite. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
