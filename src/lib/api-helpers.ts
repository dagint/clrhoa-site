/**
 * Shared helpers for API routes: JSON responses and session requirement.
 * Use requireSession() to avoid repeating cookie + secret + 401 handling.
 */
/// <reference types="@cloudflare/workers-types" />

import type { SessionPayload } from './auth';
import { getSessionFromCookie } from './auth';

/** Build a JSON Response with a given status. */
export function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Minimal Astro-like context for API routes (avoids importing Astro in lib). */
export interface ApiRequestContext {
  request: Request;
  locals: {
    runtime?: { env?: { SESSION_SECRET?: string } };
    correlationId?: string;
  };
}

/**
 * Get correlation ID from request context for logging.
 * Returns null if not available (e.g., during static generation).
 */
export function getCorrelationId(ctx: ApiRequestContext): string | null {
  return ctx.locals?.correlationId ?? null;
}

/**
 * Require an authenticated session for an API route.
 * Returns either { session } or { response } (401). Caller should return response when present.
 */
export async function requireSession(
  ctx: ApiRequestContext,
  options?: { userAgent?: string | null; ipAddress?: string | null }
): Promise<
  | { session: SessionPayload }
  | { response: Response }
> {
  const env = ctx.locals.runtime?.env;
  const cookieHeader = ctx.request.headers.get('cookie') ?? undefined;
  const session = await getSessionFromCookie(
    cookieHeader,
    env?.SESSION_SECRET,
    options?.userAgent,
    options?.ipAddress
  );
  if (!session) return { response: jsonResponse({ error: 'Unauthorized' }, 401) };
  return { session };
}

/**
 * After requireSession(), require DB. Returns 503 if missing.
 */
export function requireDb(
  env: { DB?: D1Database } | undefined
): { db: D1Database } | { response: Response } {
  if (!env?.DB) return { response: jsonResponse({ error: 'Server configuration error' }, 503) };
  return { db: env.DB };
}
