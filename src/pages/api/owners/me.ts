/**
 * GET /api/owners/me — return the current user's directory row (owner where email = session.email).
 * PUT /api/owners/me — update or create that row (name, address, phones). Body: JSON { name?, address?, lot_number?, phones? } (phones = array of strings).
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth/middleware';
import { getOwnerByEmail, upsertOwnerByEmail, insertDirectoryLog, validateLotNumber } from '../../../lib/directory-db';
import { getUserEmail, getUserRole } from '../../../types/auth';

export const GET: APIRoute = async (context) => {
  // 1. Require authentication
  const authResult = await requireAuth(context);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const { user } = authResult;
  const email = getUserEmail(user);

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'User email not found' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database not available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Get owner record
  const normalizedEmail = email.trim().toLowerCase();
  const owner = await getOwnerByEmail(db, normalizedEmail);

  if (!owner) {
    return new Response(
      JSON.stringify({ owner: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Parse phones array
  const phones = owner.phones ? (() => {
    try {
      const arr = JSON.parse(owner.phones) as unknown;
      return Array.isArray(arr) ? arr.filter((p): p is string => typeof p === 'string') : [];
    } catch { return []; }
  })() : (owner.phone ? [owner.phone] : []);

  // 4. Return owner data
  return new Response(
    JSON.stringify({
      owner: {
        id: owner.id,
        name: owner.name,
        address: owner.address,
        lot_number: owner.lot_number ?? null,
        phone: owner.phone,
        phones,
        email: owner.email,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const PUT: APIRoute = async (context) => {
  // 1. Require authentication
  const authResult = await requireAuth(context);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const { user, session } = authResult;
  const email = getUserEmail(user);

  if (!email) {
    return new Response(
      JSON.stringify({ error: 'User email not found' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database not available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Parse request body
  let body: {
    name?: string;
    address?: string;
    lot_number?: string;
    phones?: string[];
    csrf_token?: string;
    csrfToken?: string;
  };

  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Verify CSRF token (session ID is used as CSRF token)
  const csrfToken = body.csrf_token ?? body.csrfToken;
  if (!csrfToken || csrfToken !== session.id) {
    return new Response(
      JSON.stringify({ error: 'Invalid security token.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Parse and validate inputs
  const normalizedEmail = email.trim().toLowerCase();
  const name = typeof body.name === 'string' ? body.name.trim() || null : undefined;
  const address = typeof body.address === 'string' ? body.address.trim() || null : undefined;
  const lotNumber = typeof body.lot_number === 'string' ? (body.lot_number.trim() || null) : undefined;
  const rawPhones = Array.isArray(body.phones)
    ? body.phones.filter((p): p is string => typeof p === 'string').map((p) => p.trim()).filter(Boolean)
    : undefined;

  const MAX_PHONES = 5;
  const phonesArr = rawPhones !== undefined ? rawPhones.slice(0, MAX_PHONES) : undefined;
  const phonesJson = phonesArr !== undefined ? JSON.stringify(phonesArr) : undefined;

  // 5. Validate lot number if provided
  if (lotNumber !== undefined && lotNumber !== null && lotNumber !== '') {
    if (!validateLotNumber(lotNumber)) {
      return new Response(
        JSON.stringify({ error: 'Lot number must be 1–25 when provided.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 6. Update owner record
  const result = await upsertOwnerByEmail(db, normalizedEmail, {
    name,
    address,
    lot_number: lotNumber,
    phones: phonesJson
  });

  // 7. Log the update
  const clientIp = context.clientAddress || context.request.headers.get('cf-connecting-ip') || null;
  const role = getUserRole(user) || 'member';
  await insertDirectoryLog(db, email, '(directory info updated)', null, null, role, clientIp);

  // 8. Return success
  return new Response(
    JSON.stringify({
      success: true,
      id: result.id,
      created: result.created,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
