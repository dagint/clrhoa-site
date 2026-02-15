/**
 * Portal page context: env + session (and optional fingerprint).
 * Use getPortalContext(Astro) so pages don't repeat runtime/cookie/session logic.
 * effectiveRole is used for UI (PIM: member until user requests elevation).
 *
 * UPDATED: Now uses Lucia sessions from middleware instead of legacy JWT sessions.
 * The middleware sets Astro.locals.user and Astro.locals.session for authenticated users.
 */

import type { User, Session } from 'lucia';
import { getUserEmail, getUserRole } from '../types/auth';
import { isElevatedRole } from './auth/middleware';

/** Env shape available to portal pages (DB, SESSION_SECRET, etc.). Explicit type so Astro.locals inference does not narrow to never. */
export interface PortalEnv {
  SESSION_SECRET?: string;
  DB?: D1Database;
  [key: string]: unknown;
}

/** Minimal Astro-like context for portal pages. */
export interface PortalContextAstro {
  request: Request;
  locals: {
    runtime?: { env?: PortalEnv };
    user?: User | null;
    session?: Session | null;
  };
}

/** Session payload compatible with legacy code */
export interface LegacySessionPayload {
  email: string;
  role: string;
  name: string | null;
  exp: number; // Session expiration timestamp (Lucia session expiresAt)
  elevated_until?: number;
  csrfToken?: string; // Legacy CSRF token (not used in Lucia sessions)
  lastActivity?: number;
  sessionId?: string;
  fingerprint?: string;
  createdAt?: number;
  assumed_role?: 'board' | 'arb';
  assumed_at?: number;
  assumed_until?: number;
}

export interface PortalContextResult {
  env: PortalEnv | undefined;
  session: LegacySessionPayload | null;
  effectiveRole: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Get env and session for a portal page.
 * Uses Lucia session from middleware (Astro.locals.user and Astro.locals.session).
 * Returns legacy-compatible session payload for backward compatibility.
 */
export async function getPortalContext(
  astro: PortalContextAstro,
  options?: { fingerprint?: boolean }
): Promise<PortalContextResult> {
  const env = astro.locals.runtime?.env;
  const user = astro.locals.user;
  const luciaSession = astro.locals.session;
  const userAgent = astro.request.headers.get('user-agent') ?? null;
  const ipAddress =
    astro.request.headers.get('cf-connecting-ip') ??
    astro.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  // Convert Lucia session to legacy session payload for backward compatibility
  let session: LegacySessionPayload | null = null;
  if (user && luciaSession) {
    const email = getUserEmail(user);
    const role = getUserRole(user);

    if (email && role) {
      session = {
        email,
        role,
        name: null, // Name is fetched from directory by pages that need it
        exp: Math.floor(luciaSession.expiresAt.getTime() / 1000), // Convert Date to Unix timestamp in seconds
        elevated_until: (luciaSession as any).elevated_until,
        sessionId: luciaSession.id,
        csrfToken: luciaSession.id, // Use session ID as CSRF token for Lucia sessions
        createdAt: (luciaSession as any).created_at,
        fingerprint: (luciaSession as any).fingerprint,
      };
    }
  }

  // Determine effective role based on PIM elevation
  // User must have both: (1) elevated role, and (2) active elevation
  const userRole = session?.role?.toLowerCase() || 'member';
  const hasElevation = session && typeof session.elevated_until === 'number' && session.elevated_until > Date.now();
  const effectiveRole = isElevatedRole(userRole) && hasElevation ? userRole : 'member';

  return {
    env,
    session,
    effectiveRole,
    userAgent,
    ipAddress,
  };
}
