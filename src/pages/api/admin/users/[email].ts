/**
 * PATCH /api/admin/users/[email]
 *
 * Update an existing user's role, status, or contact information.
 *
 * Path Parameters:
 * - email: User's email address (URL-encoded)
 *
 * Request Body (all fields optional):
 * - role: New role (member, arb, board, arb_board, admin)
 * - status: New status (active, pending_setup, inactive, locked)
 * - name: Updated name
 * - phone: Updated phone
 * - notes: Update notes (for audit trail)
 *
 * Flow:
 * 1. Validate request (admin only)
 * 2. Check if user exists
 * 3. Validate role/status changes
 * 4. Update user record
 * 5. Log audit event (especially for role changes)
 * 6. Send notification email if role changed
 *
 * Response:
 * - 200: User updated successfully
 * - 400: Invalid request
 * - 401: Not authenticated
 * - 403: Not authorized (admin only)
 * - 404: User not found
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../lib/auth/middleware';
import { logAuditEvent } from '../../../../lib/audit-log';
import { sendRoleChangeEmail } from '../../../../lib/auth/role-change-notifications';
import { getUserEmail } from '../../../../types/auth';
import { getResendClient } from '../../../../lib/resend-client';

const VALID_ROLES = ['member', 'arb', 'board', 'arb_board', 'admin'];
const VALID_STATUSES = ['active', 'pending_setup', 'inactive', 'locked'];

interface UpdateUserRequest {
  role?: string;
  status?: string;
  name?: string;
  phone?: string;
  notes?: string;
}

export const PATCH: APIRoute = async (context) => {
  // 1. Check authentication and admin role
  const authResult = await requireRole(context, ['admin'], false);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const db = context.locals.runtime?.env?.DB;
  const resend = getResendClient(context.locals.runtime.env);

  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database not available' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const adminEmail = getUserEmail(authResult.user) || 'unknown';
  const targetEmail = decodeURIComponent(context.params.email || '');

  try {
    // 2. Parse and validate request body
    let body: UpdateUserRequest;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { role, status, name, phone, notes } = body;

    // At least one field must be provided
    if (!role && !status && !name && !phone) {
      return new Response(
        JSON.stringify({ error: 'At least one field must be provided for update' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate role if provided
    if (role && !VALID_ROLES.includes(role.toLowerCase())) {
      return new Response(
        JSON.stringify({
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status.toLowerCase())) {
      return new Response(
        JSON.stringify({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if user exists and get current values
    const currentUser = await db
      .prepare(
        `SELECT
          email,
          role,
          status,
          name,
          phone
        FROM users
        WHERE email = ?`
      )
      .bind(targetEmail)
      .first<{
        email: string;
        role: string;
        status: string;
        name: string | null;
        phone: string | null;
      }>();

    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prevent admin from demoting themselves
    if (targetEmail === adminEmail && role && role.toLowerCase() !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Cannot change your own role' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (role) {
      updates.push('role = ?');
      params.push(role.toLowerCase());
    }

    if (status) {
      updates.push('status = ?');
      params.push(status.toLowerCase());
    }

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name || null);
    }

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone || null);
    }

    // Add updated_at and updated_by
    updates.push('updated_at = CURRENT_TIMESTAMP');
    updates.push('updated_by = ?');
    params.push(adminEmail);

    // Add target email to params
    params.push(targetEmail);

    // 5. Execute update
    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE email = ?
    `;

    await db.prepare(updateQuery).bind(...params).run();

    // 6. Log audit event
    const changes: Record<string, any> = {};
    if (role && role.toLowerCase() !== currentUser.role) {
      changes.role = { from: currentUser.role, to: role.toLowerCase() };
    }
    if (status && status.toLowerCase() !== currentUser.status) {
      changes.status = { from: currentUser.status, to: status.toLowerCase() };
    }
    if (name && name !== currentUser.name) {
      changes.name = { from: currentUser.name, to: name };
    }
    if (phone && phone !== currentUser.phone) {
      changes.phone = { from: currentUser.phone, to: phone };
    }

    await logAuditEvent(db, {
      eventType: role ? 'role_changed' : 'user_updated',
      eventCategory: 'administrative',
      userId: adminEmail,
      targetUserId: targetEmail,
      action: 'update_user',
      outcome: 'success',
      details: {
        changes,
        notes: notes || null,
      },
    });

    // 7. Send role change notification email (if role changed and Resend available)
    if (role && role.toLowerCase() !== currentUser.role && resend) {
      try {
        const siteUrl = context.url.origin;
        await sendRoleChangeEmail(
          resend,
          targetEmail,
          currentUser.name,
          currentUser.role,
          role.toLowerCase(),
          adminEmail,
          siteUrl
        );
      } catch (emailError) {
        console.error('Failed to send role change notification email:', emailError);
        // Don't fail the request - update was successful
      }
    }

    // 8. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'User updated successfully',
        user: {
          email: targetEmail,
          role: role?.toLowerCase() || currentUser.role,
          status: status?.toLowerCase() || currentUser.status,
          name: name !== undefined ? name : currentUser.name,
          phone: phone !== undefined ? phone : currentUser.phone,
        },
        changes,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating user:', error);

    // Log failed attempt
    await logAuditEvent(db, {
      eventType: 'user_update_failed',
      eventCategory: 'administrative',
      userId: adminEmail,
      targetUserId: targetEmail,
      action: 'update_user',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to update user' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
