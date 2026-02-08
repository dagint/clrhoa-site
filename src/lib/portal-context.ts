/**
 * Portal page context: env + session (and optional fingerprint).
 * Use getPortalContext(Astro) so pages don't repeat runtime/cookie/session logic.
 * effectiveRole is used for UI (PIM: member until user requests elevation).
 */

import type { SessionPayload } from './auth';
import { getSessionFromCookie, getEffectiveRole } from './auth';

/** Env shape available to portal pages (DB, SESSION_SECRET, etc.). Explicit type so Astro.locals inference does not narrow to never. */
export interface PortalEnv {
  SESSION_SECRET?: string;
  DB?: D1Database;
  [key: string]: unknown;
}

/** Minimal Astro-like context for portal pages. */
export interface PortalContextAstro {
  request: Request;
  locals: { runtime?: { env?: PortalEnv } };
}

export interface PortalContextResult {
  env: PortalEnv | undefined;
  session: SessionPayload | null;
  effectiveRole: string;
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
    effectiveRole: session ? getEffectiveRole(session) : 'member',
    userAgent,
    ipAddress,
  };
}
