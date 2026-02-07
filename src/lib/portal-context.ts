/**
 * Portal page context: env + session (and optional fingerprint).
 * Use getPortalContext(Astro) so pages don't repeat runtime/cookie/session logic.
 */

import type { SessionPayload } from './auth';
import { getSessionFromCookie } from './auth';

/** Minimal Astro-like context for portal pages. */
export interface PortalContextAstro {
  request: Request;
  locals: { runtime?: { env?: { SESSION_SECRET?: string; DB?: D1Database } } };
}

export interface PortalContextResult {
  env: PortalContextAstro['locals']['runtime'] extends { env: infer E } ? E : undefined;
  session: SessionPayload | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Get env and session for a portal page. Optionally use fingerprint (userAgent + IP) for session validation.
 * If fingerprint is true and session is null, tries again without fingerprint (legacy fallback).
 */
export async function getPortalContext(
  astro: PortalContextAstro,
  options?: { fingerprint?: boolean }
): Promise<PortalContextResult> {
  const env = astro.locals.runtime?.env;
  const cookieHeader = astro.request.headers.get('cookie') ?? undefined;
  const userAgent = astro.request.headers.get('user-agent') ?? null;
  const ipAddress =
    astro.request.headers.get('cf-connecting-ip') ??
    astro.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  let session: SessionPayload | null = null;
  if (options?.fingerprint && env?.SESSION_SECRET) {
    session = await getSessionFromCookie(
      cookieHeader,
      env.SESSION_SECRET,
      userAgent,
      ipAddress
    );
    if (!session) {
      session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
    }
  } else if (env?.SESSION_SECRET) {
    session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
  }

  return {
    env,
    session,
    userAgent,
    ipAddress,
  };
}
