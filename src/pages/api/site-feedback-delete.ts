/**
 * DELETE /api/site-feedback-delete
 *
 * Admin-only endpoint to delete a specific site feedback entry.
 * Logs the deletion for audit purposes.
 */

import type { APIContext } from 'astro';
import { getEffectiveRole } from '../../lib/auth';
import { deleteSiteFeedback } from '../../lib/site-feedback-db';
import { logAdminEvent } from '../../lib/audit-log';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const env = context.locals.runtime?.env;
  const user = context.locals.user;
  const session = context.locals.session;

  if (!user || !session || !env?.DB) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const effectiveRole = getEffectiveRole(session);
  if (effectiveRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request body
  let body: { id?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const feedbackId = body.id?.trim();
  if (!feedbackId) {
    return new Response(JSON.stringify({ error: 'Feedback ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const deleted = await deleteSiteFeedback(env.DB, feedbackId);

    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Feedback not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Log the deletion for audit purposes
    await logAdminEvent(env.DB, {
      eventType: 'delete_site_feedback',
      userId: user.email,
      action: `Deleted site feedback entry`,
      resourceType: 'site_feedback',
      resourceId: feedbackId,
      details: { feedbackId },
      ipAddress: context.clientAddress || null,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting site feedback:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
