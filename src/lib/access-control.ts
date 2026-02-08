/**
 * Centralized access control for resource ownership and role-based access.
 * Use these helpers so ownership checks are consistent and no route forgets them.
 */

import type { SessionPayload } from './auth';
import { isElevatedRole } from './auth';
import type { ArbRequest } from './arb-db';
import { getArbRequest } from './arb-db';
import { listEmailsAtSameAddress } from './directory-db.js';
import { jsonResponse } from './api-helpers';

/** True if the session user is the request owner or in the same household (same address). */
async function isOwnerOrHousehold(
  db: D1Database,
  ownerEmail: string,
  sessionEmail: string
): Promise<boolean> {
  const household = await listEmailsAtSameAddress(db, ownerEmail);
  return household.includes(sessionEmail.trim().toLowerCase());
}

/**
 * Require that the user can access this ARB request: owner, a household member (same address), or an elevated role.
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
  const isOwnerOrInHousehold = await isOwnerOrHousehold(db, request.owner_email, session.email);
  const isElevated = isElevatedRole(session.role);
  if (!isOwnerOrInHousehold && !isElevated)
    return { response: jsonResponse({ error: 'Forbidden' }, 403) };
  return { request };
}

/**
 * Require that the user is the owner or a household member of the ARB request. Optionally require status === 'pending' (for edit/cancel/remove).
 * Use for owner/household actions (cancel, remove file, add file, edit, notes).
 */
export async function requireArbRequestOwner(
  db: D1Database,
  requestId: string,
  session: SessionPayload,
  options?: { requirePending?: boolean }
): Promise<{ request: ArbRequest } | { response: Response }> {
  const request = await getArbRequest(db, requestId);
  if (!request)
    return { response: jsonResponse({ error: 'Request not found' }, 404) };
  const isOwnerOrInHousehold = await isOwnerOrHousehold(db, request.owner_email, session.email);
  if (!isOwnerOrInHousehold)
    return { response: jsonResponse({ error: 'You do not have access to this request.' }, 403) };
  if (options?.requirePending && request.status !== 'pending')
    return {
      response: jsonResponse(
        { error: `Only pending requests can be modified. This request is already ${request.status}.` },
        400
      ),
    };
  return { request };
}
