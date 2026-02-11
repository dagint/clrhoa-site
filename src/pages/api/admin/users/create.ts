/**
 * POST /api/admin/users/create
 *
 * Create a new user account and send password setup email.
 *
 * Request Body:
 * - email: User's email address (required)
 * - role: User role (required) - member, arb, board, arb_board, admin
 * - name: User's full name (optional)
 * - phone: User's phone number (optional)
 * - sendEmail: Whether to send password setup email (default: true)
 *
 * Flow:
 * 1. Validate request (admin only)
 * 2. Validate email and role
 * 3. Check if user already exists
 * 4. Create user record with status='pending_setup'
 * 5. Generate password setup token
 * 6. Send password setup email
 * 7. Log audit event
 *
 * Response:
 * - 201: User created successfully
 * - 400: Invalid request (missing fields, invalid role)
 * - 401: Not authenticated
 * - 403: Not authorized (admin only)
 * - 409: User already exists
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../lib/auth/middleware';
import { generateSetupToken, sendSetupEmail } from '../../../../lib/auth/setup-tokens';
import { logAuditEvent } from '../../../../lib/audit-log';
import { validateAndNormalizeEmail } from '../../../../lib/email-validation';

const VALID_ROLES = ['member', 'arb', 'board', 'arb_board', 'admin'];
const VALID_STATUSES = ['active', 'pending_setup', 'inactive'];

interface CreateUserRequest {
  email: string;
  role: string;
  name?: string;
  phone?: string;
  sendEmail?: boolean;
}

// Email validation now handled by validateAndNormalizeEmail() utility

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

  const adminEmail = (authResult.user as any).email;

  try {
    // 2. Parse and validate request body
    let body: CreateUserRequest;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email, role, name, phone, sendEmail = true } = body;

    // Validate required fields
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'Email and role are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize email format
    const normalizedEmail = validateAndNormalizeEmail(email);
    if (!normalizedEmail) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format. Please provide a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    if (!VALID_ROLES.includes(role.toLowerCase())) {
      return new Response(
        JSON.stringify({
          error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Email already normalized by validateAndNormalizeEmail() above
    const normalizedRole = role.toLowerCase();

    // 3. Check if user already exists
    const existingUser = await db
      .prepare('SELECT email, status FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first<{ email: string; status: string }>();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: 'User already exists',
          details: `A user with email ${normalizedEmail} already exists with status: ${existingUser.status}`,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Create user record
    await db
      .prepare(
        `INSERT INTO users (
          email,
          role,
          name,
          phone,
          status,
          created_by,
          created,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(
        normalizedEmail,
        normalizedRole,
        name || null,
        phone || null,
        'pending_setup',
        adminEmail
      )
      .run();

    // 5. Generate password setup token
    const { token, tokenId, expiresAt } = await generateSetupToken(
      db,
      normalizedEmail,
      adminEmail
    );

    // 6. Send password setup email (if requested)
    if (sendEmail && resend) {
      try {
        const siteUrl = context.url.origin;
        await sendSetupEmail(resend, normalizedEmail, token, name, siteUrl);
      } catch (emailError) {
        console.error('Failed to send password setup email:', emailError);
        // Don't fail the request - user was created successfully
        // Admin can resend the email later
      }
    }

    // 7. Log audit event
    await logAuditEvent(db, {
      eventType: 'user_created',
      eventCategory: 'administrative',
      userId: adminEmail,
      targetUserId: normalizedEmail,
      action: 'create_user',
      outcome: 'success',
      details: {
        role: normalizedRole,
        name: name || null,
        phone: phone || null,
        email_sent: sendEmail && !!resend,
        token_id: tokenId,
        token_expires: expiresAt,
      },
    });

    // 8. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully',
        user: {
          email: normalizedEmail,
          role: normalizedRole,
          name: name || null,
          status: 'pending_setup',
        },
        setupToken: {
          sent: sendEmail && !!resend,
          expiresAt,
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating user:', error);

    // Log failed attempt
    await logAuditEvent(db, {
      eventType: 'user_creation_failed',
      eventCategory: 'administrative',
      userId: adminEmail,
      action: 'create_user',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to create user' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
