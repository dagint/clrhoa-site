/**
 * DELETE /api/members
 *
 * Delete a member from both authentication (users) and directory (owners) tables.
 * Board/Admin only.
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "csrf_token": "..."
 * }
 *
 * Response:
 * - 200: Member deleted successfully
 * - 400: Invalid request
 * - 403: Forbidden (not board/admin or invalid CSRF)
 * - 404: Member not found
 * - 500: Server error
 */

import type { APIRoute } from 'astro';
import { verifyCsrfToken, getEffectiveRole, isBoardOnly } from '../../lib/auth';
import { getOwnerByEmail, deleteOwner } from '../../lib/directory-db';
import { logSecurityEvent } from '../../lib/audit-log';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const user = locals.user;
  const session = locals.session;
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

  // 3. CSRF check (but email is not passed via CSRF, so we get it from body)
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
    // 4. Check if member exists in either table
    const userExists = await db
      .prepare('SELECT email FROM users WHERE email = ?')
      .bind(targetEmail)
      .first<{ email: string }>();

    const ownerExists = await db
      .prepare('SELECT email FROM owners WHERE email = ?')
      .bind(targetEmail)
      .first<{ email: string }>();

    if (!userExists && !ownerExists) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let deletedFrom: string[] = [];

    // 5. Delete from users table (authentication)
    if (userExists) {
      // Also delete related sessions
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(targetEmail).run();

      // Delete user account
      const result = await db.prepare('DELETE FROM users WHERE email = ?').bind(targetEmail).run();
      if ((result.meta?.changes ?? 0) > 0) {
        deletedFrom.push('users');
      }
    }

    // 6. Delete from owners table (directory) using the helper that logs audit
    if (ownerExists) {
      // Get owner by email to find the ID
      const owner = await getOwnerByEmail(db, targetEmail);
      if (owner) {
        const deleted = await deleteOwner(db, owner.id, user.email, {
          ip_address: ipAddress,
          role: effectiveRole,
          operation_type: 'manual',
        });
        if (deleted) {
          deletedFrom.push('directory');
        }
      }
    }

    // 7. Log security event
    await logSecurityEvent(db, {
      eventType: 'member_deleted',
      severity: 'info',
      userId: targetEmail,
      details: {
        deleted_by: user.email,
        deleted_from: deletedFrom,
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Member deleted from ${deletedFrom.join(' and ')}`,
        deletedFrom,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete member error:', error);

    await logSecurityEvent(db, {
      eventType: 'member_delete_failed',
      severity: 'critical',
      details: {
        email: targetEmail,
        deleted_by: user.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to delete member. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
