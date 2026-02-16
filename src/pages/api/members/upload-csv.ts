/**
 * POST /api/members/upload-csv
 *
 * Unified CSV upload for members (creates/updates both directory and account entries).
 * Handles existing records gracefully - updates instead of errors.
 *
 * FormData:
 * - file: CSV file (required)
 * - csrf_token: CSRF token (required)
 *
 * CSV columns (case-insensitive, header row optional):
 * - name: Member name
 * - email: Email address (used for matching existing records)
 * - address: Physical address
 * - lot_number: Lot number
 * - phone: Phone number
 * - role: Account role (member, board, arb, admin) - optional, defaults to 'member'
 *
 * Response:
 * {
 *   success: true,
 *   added: number,        // New records created
 *   updated: number,      // Existing records updated
 *   skipped: number,      // Rows skipped (no email or name)
 *   errors: string[]      // Any errors encountered
 * }
 */

import type { APIRoute } from 'astro';
import { getEffectiveRole, isElevatedRole, VALID_ROLES, verifyCsrfToken } from '../../../lib/auth';
import { getMemberByEmail } from '../../../lib/members-db';
import { insertOwner, updateOwner } from '../../../lib/directory-db';
import { setLoginWhitelistRole } from '../../../lib/auth';
import { checkRateLimit, getRateLimitConfig } from '../../../lib/rate-limit';

export const prerender = false;

/** Parse a single CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cur += c;
    } else if (c === ',' || c === '\t') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const session = locals.session;

  // 1. Authentication check
  if (!session || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const effectiveRole = getEffectiveRole(session as any);
  if (!isElevatedRole(effectiveRole)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = locals.runtime?.env?.DB;
  const kv = locals.runtime?.env?.CLOURHOA_USERS;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Rate limiting
  const rateLimitKv = locals.runtime?.env?.KV;
  const clientIpAddress = request.headers.get('cf-connecting-ip') || 'unknown';
  const endpoint = '/api/members/upload-csv';
  const rateLimitConfig = getRateLimitConfig(endpoint);

  if (rateLimitConfig && rateLimitKv) {
    const rateLimit = await checkRateLimit(
      rateLimitKv,
      endpoint,
      clientIpAddress,
      rateLimitConfig.maxRequests,
      rateLimitConfig.windowSeconds
    );
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. Maximum ${rateLimitConfig.maxRequests} uploads per ${rateLimitConfig.windowSeconds / 60} minutes. Please try again later.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }
  }

  // 3. Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. CSRF verification
  const csrf = (formData.get('csrf_token') ?? formData.get('csrfToken'))?.toString() ?? '';
  console.log('[CSV-UPLOAD] CSRF Debug:', {
    csrfToken: csrf?.substring(0, 20) + '...',
    hasSession: !!session,
    sessionKeys: session ? Object.keys(session) : [],
  });

  if (!verifyCsrfToken(session as any, csrf)) {
    console.log('[CSV-UPLOAD] CSRF verification failed');
    return new Response(JSON.stringify({ error: 'Invalid security token.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[CSV-UPLOAD] CSRF verification passed');

  // 5. Get CSV file
  const file = formData.get('file') ?? formData.get('csv');
  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'No CSV file provided. Use form field "file" or "csv".' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. Check file size
  const MAX_CSV_BYTES = 1 * 1024 * 1024; // 1MB
  const MAX_CSV_ROWS = 1000;
  const fileBlob = file as Blob;
  if (fileBlob.size > MAX_CSV_BYTES) {
    return new Response(JSON.stringify({ error: `CSV file must be under ${MAX_CSV_BYTES / 1024 / 1024}MB.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 7. Read file content
  let text: string;
  try {
    text = await fileBlob.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Could not read file as text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 8. Parse CSV
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return new Response(JSON.stringify({ success: true, added: 0, updated: 0, skipped: 0, message: 'File is empty' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 9. Detect columns
  const header = parseCsvLine(lines[0]!);
  const col = (name: string) => {
    const lower = name.toLowerCase();
    const i = header.findIndex((h) => h.toLowerCase() === lower);
    return i >= 0 ? i : -1;
  };

  const nameCol = col('name') >= 0 ? col('name') : 0;
  const emailCol = col('email') >= 0 ? col('email') : -1;
  const addressCol = col('address') >= 0 ? col('address') : -1;
  const phoneCol = col('phone') >= 0 ? col('phone') : -1;
  const lotNumberCol = col('lot_number') >= 0 ? col('lot_number') : col('lot') >= 0 ? col('lot') : -1;
  const roleCol = col('role') >= 0 ? col('role') : -1;

  // 10. Determine if first row is header
  let startRow = 0;
  const first = header.map((h) => h.toLowerCase());
  if (first.includes('name') || first.includes('email') || first.includes('address')) {
    startRow = 1;
  }

  if (lines.length > MAX_CSV_ROWS) {
    return new Response(JSON.stringify({ error: `CSV has too many rows. Maximum ${MAX_CSV_ROWS} rows.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 11. Process rows
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]!);

    const name = nameCol >= 0 ? (row[nameCol] ?? '').trim() || null : null;
    const email = emailCol >= 0 ? (row[emailCol] ?? '').trim()?.toLowerCase() || null : null;
    const address = addressCol >= 0 ? (row[addressCol] ?? '').trim() || null : null;
    const phone = phoneCol >= 0 ? (row[phoneCol] ?? '').trim() || null : null;
    const lotNumber = lotNumberCol >= 0 ? (row[lotNumberCol] ?? '').trim() || null : null;
    const roleRaw = roleCol >= 0 ? (row[roleCol] ?? '').trim()?.toLowerCase() || null : null;
    const role = roleRaw && VALID_ROLES.has(roleRaw) ? roleRaw : 'member';

    // Skip rows without email or name
    if (!email && !name) {
      skipped += 1;
      continue;
    }

    // Skip rows with just whitespace
    if (!name && !address && !email && !phone) {
      skipped += 1;
      continue;
    }

    try {
      if (email) {
        // Check if member exists
        const existing = await getMemberByEmail(db, email);

        if (existing) {
          // Update existing member
          let didUpdate = false;

          // Update directory entry if exists
          if (existing.inDirectory && existing.ownerId) {
            await updateOwner(
              db,
              existing.ownerId,
              {
                name: name || existing.name,
                address: address || existing.address,
                lot_number: lotNumber || existing.lot_number,
                phone: phone || existing.phone,
              },
              user.email
            );
            didUpdate = true;
          } else if (name || address || phone || lotNumber) {
            // Create directory entry if doesn't exist
            await insertOwner(
              db,
              {
                name,
                email,
                address,
                lot_number: lotNumber,
                phone,
              },
              user.email
            );
            didUpdate = true;
          }

          // Update role in KV if changed
          if (kv && role && role !== existing.role) {
            await setLoginWhitelistRole(kv, email, role);
            didUpdate = true;
          }

          // Update user record if exists
          if (existing.hasAccount && existing.userId && name) {
            await db
              .prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
              .bind(name, role, existing.userId)
              .run();
            didUpdate = true;
          }

          if (didUpdate) {
            updated += 1;
          } else {
            skipped += 1;
          }
        } else {
          // Create new member
          // 1. Add to directory
          await insertOwner(
            db,
            {
              name,
              email,
              address,
              lot_number: lotNumber,
              phone,
            },
            user.email
          );

          // 2. Add to KV whitelist for account creation
          if (kv) {
            await setLoginWhitelistRole(kv, email, role);
          }

          added += 1;
        }
      } else {
        // No email - just add to directory
        await insertOwner(
          db,
          {
            name,
            email: null,
            address,
            lot_number: lotNumber,
            phone,
          },
          user.email
        );
        added += 1;
      }
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      added,
      updated,
      skipped,
      ...(errors.length ? { errors } : {}),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
