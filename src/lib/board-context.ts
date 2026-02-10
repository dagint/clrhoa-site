/**
 * Board page context: env + session with elevated role.
 * Use getBoardContext(Astro) so board pages don't repeat cookie/session/redirect logic.
 */

import type { SessionPayload } from './auth';
import { getSessionFromCookie, isElevatedRole, getEffectiveRole, isAdminRole } from './auth';

/** Env shape for board pages (after SESSION_SECRET guard). */
export interface BoardEnv {
  SESSION_SECRET?: string;
  DB?: D1Database;
  CLOURHOA_USERS?: KVNamespace;
}

/** Minimal Astro-like context for board pages. */
export interface BoardContextAstro {
  request: Request;
  locals: { runtime?: { env?: BoardEnv } };
}

export interface BoardContextResult {
  env: BoardEnv;
  session: SessionPayload;
  effectiveRole: string;
}

export type GetBoardContextResult =
  | BoardContextResult
  | { redirect: string };

/**
 * Get env and session for a board page. Returns redirect URL if no session
 * or session is not elevated (board, admin, arb, arb_board). Caller should
 * do: if ('redirect' in r) return Astro.redirect(r.redirect);
 */
export async function getBoardContext(astro: BoardContextAstro): Promise<GetBoardContextResult> {
  const env = astro.locals.runtime?.env;
  const cookieHeader = astro.request.headers.get('cookie') ?? undefined;

  if (!env?.SESSION_SECRET) {
    return { redirect: '/portal/login' };
  }

  const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
  if (!session) {
    return { redirect: '/portal/login' };
  }

  if (!isElevatedRole(getEffectiveRole(session))) {
    return { redirect: '/portal/dashboard' };
  }

  return { env, session, effectiveRole: getEffectiveRole(session) };
}

/**
 * Get context for admin-only pages. Redirects if not admin.
 * Use for /portal/admin/* pages.
 */
export async function getAdminContext(astro: BoardContextAstro): Promise<GetBoardContextResult> {
  const result = await getBoardContext(astro);
  if ('redirect' in result) return result;
  if (!isAdminRole(result.effectiveRole)) {
    if (result.effectiveRole === 'board' || result.effectiveRole === 'arb_board') return { redirect: '/portal/board' };
    if (result.effectiveRole === 'arb') return { redirect: '/portal/arb' };
    return { redirect: '/portal/dashboard' };
  }
  return result;
}
