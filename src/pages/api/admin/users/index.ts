/**
 * GET /api/admin/users
 *
 * List all users in the system with pagination and filtering.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 * - role: Filter by role (member, arb, board, arb_board, admin)
 * - status: Filter by status (active, pending_setup, inactive, locked)
 * - search: Search by name or email
 *
 * Response:
 * - 200: List of users
 * - 401: Not authenticated
 * - 403: Not authorized (admin only)
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireRole } from '../../../../lib/auth/middleware';

interface UserListItem {
  email: string;
  name: string | null;
  role: string;
  status: string;
  phone: string | null;
  created: string;
  last_login: string | null;
  mfa_enabled: boolean;
  created_by: string | null;
}

export const GET: APIRoute = async (context) => {
  // 1. Check authentication and admin role
  const authResult = await requireRole(context, ['admin'], false);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database not available' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. Parse query parameters
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const roleFilter = url.searchParams.get('role') || null;
    const statusFilter = url.searchParams.get('status') || null;
    const search = url.searchParams.get('search') || null;
    const offset = (page - 1) * limit;

    // 3. Build query with filters
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (roleFilter) {
      whereConditions.push('role = ?');
      params.push(roleFilter);
    }

    if (statusFilter) {
      whereConditions.push('status = ?');
      params.push(statusFilter);
    }

    if (search && search.trim()) {
      whereConditions.push('(email LIKE ? OR name LIKE ?)');
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // 4. Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await db
      .prepare(countQuery)
      .bind(...params)
      .first<{ total: number }>();

    const totalCount = countResult?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // 5. Get users with pagination
    const usersQuery = `
      SELECT
        email,
        name,
        role,
        status,
        phone,
        created,
        last_login,
        mfa_enabled,
        created_by
      FROM users
      ${whereClause}
      ORDER BY created DESC
      LIMIT ? OFFSET ?
    `;

    const usersResult = await db
      .prepare(usersQuery)
      .bind(...params, limit, offset)
      .all<UserListItem>();

    const users = usersResult.results || [];

    // 6. Return paginated results
    return new Response(
      JSON.stringify({
        success: true,
        users,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: {
          role: roleFilter,
          status: statusFilter,
          search,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error listing users:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list users' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
