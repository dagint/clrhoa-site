/**
 * TEST-ONLY API endpoint to create Lucia sessions for E2E tests.
 *
 * This endpoint should ONLY be available in test environments.
 * It creates proper Lucia sessions that will be validated correctly.
 */

import type { APIContext } from 'astro';
import { createLucia } from '../../../lib/lucia';
import { createSession } from '../../../lib/lucia/session';

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  // SECURITY: Only allow in development/test (not production)
  // In production, DB will be the production database, not a test database
  // This is safe because production uses remote D1, not local
  const isDevelopment = context.url.hostname === 'localhost' ||
                        context.url.hostname === '127.0.0.1' ||
                        context.url.hostname.includes('local');

  if (!isDevelopment) {
    return new Response(JSON.stringify({ error: 'Not available' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await context.request.json() as { userId?: string; elevated?: boolean; assumeRole?: string };
    const { userId, elevated = false, assumeRole } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const env = context.locals.runtime?.env;
    if (!env?.DB) {
      return new Response(JSON.stringify({ error: 'Database not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hostname = context.url.hostname;
    const lucia = createLucia(env.DB, hostname);

    // Create session with Lucia
    const session = await createSession(
      env.DB,
      lucia,
      userId,
      '127.0.0.1',
      'Playwright-Test'
    );

    // Add PIM attributes if elevated
    if (elevated) {
      const elevatedUntil = Date.now() + (30 * 60 * 1000); // 30 minutes
      await env.DB
        .prepare('UPDATE sessions SET elevated_until = ? WHERE id = ?')
        .bind(elevatedUntil, session.id)
        .run();
    }

    // Add role assumption if requested
    if (assumeRole) {
      const assumedAt = Date.now();
      const assumedUntil = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
      await env.DB
        .prepare('UPDATE sessions SET assumed_role = ?, assumed_at = ?, assumed_until = ? WHERE id = ?')
        .bind(assumeRole, assumedAt, assumedUntil, session.id)
        .run();
    }

    return new Response(JSON.stringify({
      sessionId: session.id,
      expiresAt: session.expiresAt.getTime(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create test session:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
