/**
 * API endpoint for managing board and ARB positions
 * POST: Assign a position to a user
 * DELETE: Remove a position from a user
 * GET: Get current positions
 */
import type { APIRoute } from 'astro';
import { getSessionFromCookie, verifyCsrfToken } from '../../../lib/auth';
import {
  assignBoardPosition,
  endBoardPosition,
  getCurrentPositions,
  getUserCurrentPosition,
  BOARD_TITLES,
  type BoardTitle,
} from '../../../lib/board-positions-db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB || !env?.SESSION_SECRET) {
    return new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 });
  }

  const cookieHeader = request.headers.get('cookie') ?? undefined;
  const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check permission: admin, board, or arb (for ARB titles only)
  const effectiveRole = session.elevated_until && session.elevated_until > Date.now()
    ? session.assumed_role || session.role
    : session.role;

  const canManageBoard = effectiveRole === 'admin' || effectiveRole === 'board' || effectiveRole === 'arb_board';
  const canManageArb = canManageBoard || effectiveRole === 'arb';

  if (!canManageBoard && !canManageArb) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403 });
  }

  try {
    const body = await request.json() as { email?: string; title?: string; action?: string; csrf_token?: string };

    // CSRF validation
    if (!verifyCsrfToken(session, body.csrf_token)) {
      return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), { status: 403 });
    }

    const { email, title, action } = body;

    if (!email || !title) {
      return new Response(JSON.stringify({ error: 'Email and title are required' }), { status: 400 });
    }

    // Validate title
    const validTitles = Object.values(BOARD_TITLES);
    if (!validTitles.includes(title as BoardTitle)) {
      return new Response(JSON.stringify({ error: 'Invalid title' }), { status: 400 });
    }

    // Check ARB-only permission (can only manage ARB positions)
    const isArbTitle = title === BOARD_TITLES.ARB_CHAIR || title === BOARD_TITLES.ARB_MEMBER;
    if (effectiveRole === 'arb' && !isArbTitle) {
      return new Response(JSON.stringify({ error: 'ARB can only manage ARB positions' }), { status: 403 });
    }

    if (action === 'assign') {
      const result = await assignBoardPosition(env.DB, email, title as BoardTitle, session.email);
      if (!result.success) {
        return new Response(JSON.stringify({ error: result.error || 'Failed to assign position' }), { status: 400 });
      }
      return new Response(JSON.stringify({ success: true, message: `Assigned ${title} to ${email}` }), { status: 200 });
    } else if (action === 'remove') {
      const success = await endBoardPosition(env.DB, email, title as BoardTitle);
      if (!success) {
        return new Response(JSON.stringify({ error: 'Failed to remove position' }), { status: 400 });
      }
      return new Response(JSON.stringify({ success: true, message: `Removed ${title} from ${email}` }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }
  } catch (error) {
    console.error('[API /admin/board-positions] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB || !env?.SESSION_SECRET) {
    return new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 });
  }

  const cookieHeader = request.headers.get('cookie') ?? undefined;
  const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Allow board, arb, or admin to view positions
  const effectiveRole = session.elevated_until && session.elevated_until > Date.now()
    ? session.assumed_role || session.role
    : session.role;

  const canView = effectiveRole === 'admin' || effectiveRole === 'board' || effectiveRole === 'arb' || effectiveRole === 'arb_board';
  if (!canView) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403 });
  }

  try {
    const positions = await getCurrentPositions(env.DB);
    return new Response(JSON.stringify({ positions }), { status: 200 });
  } catch (error) {
    console.error('[API /admin/board-positions GET] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
