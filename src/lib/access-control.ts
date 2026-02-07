/**
 * Centralized access control for resource ownership and role-based access.
 * Use these helpers so ownership checks are consistent and no route forgets them.
 */

import type { SessionPayload } from './auth';
import { isElevatedRole } from './auth';
import type { ArbRequest } from './arb-db';
import { getArbRequest } from './arb-db';
import { jsonResponse } from './api-helpers';

/**
 * Require that the user can access this ARB request: either the owner or an elevated role (board, arb, admin, arb_board).
 * Use for viewing/downloading request or attachments.
 */
export async function requireArbRequestAccess(
  db: D1Database,
  requestId: string,
  session: SessionPayload
): Promise<{ request: ArbRequest } | { response: Response }> {
  const request = await getArbRequest(db, requestId);
  if (!request)
    return { response: jsonResponse({ error: 'Request not found' }, 404) };
  const isOwner = request.owner_email.toLowerCase() === session.email.toLowerCase();
  const isElevated = isElevatedRole(session.role);
  if (!isOwner && !isElevated)
    return { response: jsonResponse({ error: 'Forbidden' }, 403) };
  return { request };
}

/**
 * Require that the user is the owner of the ARB request. Optionally require status === 'pending' (for edit/cancel/remove).
 * Use for owner-only actions (cancel, remove file, add file).
 */
export async function requireArbRequestOwner(
  db: D1Database,
  requestId: string,
  session: SessionPayload,
  options?: { requirePending?: boolean }
): Promise<{ request: ArbRequest } | { response: Response }> {
  const request = await getArbRequest(db, requestId);
  if (!request || request.owner_email.toLowerCase() !== session.email.toLowerCase())
    return { response: jsonResponse({ error: 'Request not found or you do not own it.' }, 404) };
  if (options?.requirePending && request.status !== 'pending')
    return {
      response: jsonResponse(
        { error: `Only pending requests can be modified. This request is already ${request.status}.` },
        400
      ),
    };
  return { request };
}
