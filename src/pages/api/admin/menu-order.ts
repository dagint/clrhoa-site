/**
 * API endpoint for managing portal menu order
 * GET: Get current menu items
 * POST: Update menu order or reset to defaults
 */
import type { APIRoute } from 'astro';
import { logAdminEvent } from '../../../lib/audit-log';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env;
  const session = locals.session;
  const user = locals.user;

  if (!session || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Admin only
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  if (!env?.DB) {
    return new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 });
  }

  try {
    const { getMenuItems } = await import('../../../lib/menu-db');
    const items = await getMenuItems(env.DB);

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[API /admin/menu-order] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  const session = locals.session;
  const user = locals.user;

  if (!session || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Admin only
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  if (!env?.DB) {
    return new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 });
  }

  try {
    const body = await request.json() as { action?: string; items?: Array<{ id: string; position: number }>; csrf_token?: string };

    // CSRF validation
    const { verifyCsrfToken } = await import('../../../lib/auth');
    if (!verifyCsrfToken(session, body.csrf_token)) {
      return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), { status: 403 });
    }

    const { updateMenuOrder, resetMenuToDefaults } = await import('../../../lib/menu-db');

    const ipAddress = request.headers.get('cf-connecting-ip') ?? null;

    if (body.action === 'reset') {
      // Reset to defaults
      const success = await resetMenuToDefaults(env.DB);
      if (!success) {
        return new Response(JSON.stringify({ error: 'Failed to reset menu' }), { status: 500 });
      }
      await logAdminEvent(env.DB, {
        eventType: 'menu_order_reset',
        userId: user.email,
        action: 'Reset portal menu order to defaults',
        resourceType: 'menu',
        ipAddress,
        outcome: 'success',
      }).catch(() => {});
      return new Response(JSON.stringify({ success: true, message: 'Menu reset to defaults' }), { status: 200 });
    }

    if (body.action === 'update' && body.items) {
      // Update order
      const success = await updateMenuOrder(env.DB, body.items);
      if (!success) {
        return new Response(JSON.stringify({ error: 'Failed to update menu order' }), { status: 500 });
      }
      await logAdminEvent(env.DB, {
        eventType: 'menu_order_updated',
        userId: user.email,
        action: 'Updated portal menu order',
        resourceType: 'menu',
        ipAddress,
        outcome: 'success',
        details: { item_count: body.items.length },
      }).catch(() => {});
      return new Response(JSON.stringify({ success: true, message: 'Menu order updated' }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (error) {
    console.error('[API /admin/menu-order] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
