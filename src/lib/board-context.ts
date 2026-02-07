/**
 * Board page context: env + session with elevated role.
 * Use getBoardContext(Astro) so board pages don't repeat cookie/session/redirect logic.
 */

import type { SessionPayload } from './auth';
import { getSessionFromCookie, isElevatedRole } from './auth';

/** Minimal Astro-like context for board pages. */
export interface BoardContextAstro {
  request: Request;
  locals: { runtime?: { env?: { SESSION_SECRET?: string; DB?: D1Database } } };
}

export interface BoardContextResult {
  env: BoardContextAstro['locals']['runtime'] extends { env: infer E } ? E : undefined;
  session: SessionPayload;
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

  if (!isElevatedRole(session.role)) {
    return { redirect: '/portal/dashboard' };
  }

  return { env, session };
}
