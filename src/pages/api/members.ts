/**
 * Unified Members API - Manages both authentication accounts and directory entries
 *
 * GET: List all members (unified view)
 * POST: Create new member (creates both user account + directory entry)
 * PUT: Update member (updates both tables)
 * DELETE: Delete member (removes from both tables)
 */

import type { APIRoute } from 'astro';
import { getMemberByEmail, listAllMembers } from '../../lib/members-db';
import { getEffectiveRole, isElevatedRole, VALID_ROLES } from '../../lib/auth';
import { insertOwner, updateOwner, deleteOwners } from '../../lib/directory-db';
import { setLoginWhitelistRole, removeFromLoginWhitelistUnlessAdmin } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  const session = locals.session;

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
  if (!db) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const members = await listAllMembers(db, 1000, 0);
    return new Response(JSON.stringify({ members }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[MEMBERS-API] GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch members' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const session = locals.session;

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

  let body: {
    email: string;
    name?: string;
    role?: string;
    address?: string;
    lot_number?: string;
    phone?: string;
    createAccount?: boolean;
    addToDirectory?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = body.email?.trim()?.toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = body.name?.trim() || null;
  const role = VALID_ROLES.has(body.role?.toLowerCase() || '') ? body.role!.toLowerCase() : 'member';
  const createAccount = body.createAccount !== false; // Default true
  const addToDirectory = body.addToDirectory !== false; // Default true

  try {
    // Check if already exists
    const existing = await getMemberByEmail(db, email);
    if (existing && ((createAccount && existing.hasAccount) || (addToDirectory && existing.inDirectory))) {
      return new Response(
        JSON.stringify({
          error: 'Member already exists with this email',
          existing: {
            hasAccount: existing.hasAccount,
            inDirectory: existing.inDirectory,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create directory entry if requested
    let ownerId: string | null = null;
    if (addToDirectory) {
      ownerId = await insertOwner(
        db,
        {
          name,
          email,
          address: body.address?.trim() || null,
          lot_number: body.lot_number?.trim() || null,
          phone: body.phone?.trim() || null,
        },
        user.email
      );
    }

    // Create user account if requested (sets up in KV whitelist for password setup)
    if (createAccount && kv) {
      await setLoginWhitelistRole(kv, email, role);
      // User will appear in users table after they set their password
      // For now they're just in the KV whitelist
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: createAccount
          ? 'Member added. They can now use "Forgot Password" to set up their account.'
          : 'Member added to directory.',
        member: {
          email,
          name,
          role,
          ownerId,
          hasAccount: false, // Account created after password setup
          inDirectory: addToDirectory,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[MEMBERS-API] POST error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create member' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const session = locals.session;

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

  let body: {
    email: string;
    name?: string;
    role?: string;
    address?: string;
    lot_number?: string;
    phone?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = body.email?.trim()?.toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const member = await getMemberByEmail(db, email);
    if (!member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update directory entry if exists
    if (member.inDirectory && member.ownerId) {
      await updateOwner(
        db,
        member.ownerId,
        {
          name: body.name?.trim() || member.name,
          address: body.address?.trim() || member.address,
          lot_number: body.lot_number?.trim() || member.lot_number,
          phone: body.phone?.trim() || member.phone,
        },
        user.email
      );
    }

    // Update user role in KV if role changed
    if (body.role && kv && VALID_ROLES.has(body.role.toLowerCase())) {
      await setLoginWhitelistRole(kv, email, body.role.toLowerCase());
    }

    // Update user record in users table if exists
    if (member.hasAccount && member.userId) {
      const role = body.role?.toLowerCase() || member.role || 'member';
      await db
        .prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
        .bind(body.name?.trim() || member.name, role, member.userId)
        .run();
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Member updated successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[MEMBERS-API] PUT error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update member' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const session = locals.session;

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

  let body: { email: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = body.email?.trim()?.toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const member = await getMemberByEmail(db, email);
    if (!member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete from directory if exists
    if (member.inDirectory && member.ownerId) {
      await deleteOwners(db, [member.ownerId]);
    }

    // Delete from users table if exists
    if (member.hasAccount && member.userId) {
      await db.prepare('DELETE FROM users WHERE id = ?').bind(member.userId).run();
    }

    // Remove from KV whitelist
    if (kv) {
      await removeFromLoginWhitelistUnlessAdmin(kv, email);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Member deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[MEMBERS-API] DELETE error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete member' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
