/**
 * Unified Members Database - Combines authentication (users) and directory (owners)
 *
 * This provides a unified interface for managing both user accounts and directory entries.
 * A "member" can have:
 * - User account (authentication, login)
 * - Directory entry (contact info, address)
 * - Both (most common for homeowners)
 * - Neither (shouldn't happen, but handle gracefully)
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface UnifiedMember {
  email: string;
  name: string | null;

  // User account fields (if has account)
  hasAccount: boolean;
  accountStatus: 'active' | 'pending_setup' | 'suspended' | null;
  role: string | null;
  userId: string | null;

  // Directory fields (if in directory)
  inDirectory: boolean;
  ownerId: string | null;
  address: string | null;
  lot_number: string | null;
  phone: string | null;
  phones: string | null;

  // Metadata
  created_at: string | null;
  updated_at: string | null;
}

/**
 * List all members (unified view of users + owners)
 * Performs a FULL OUTER JOIN on email to get all records from both tables
 */
export async function listAllMembers(
  db: D1Database,
  limit = 100,
  offset = 0
): Promise<UnifiedMember[]> {
  // Since D1 doesn't support FULL OUTER JOIN, we'll do UNION of LEFT JOINs
  // Wrap in subquery to allow ORDER BY with UNION
  const query = `
    SELECT * FROM (
      SELECT
        COALESCE(u.email, o.email) as email,
        COALESCE(u.name, o.name) as name,
        u.id as userId,
        u.status as accountStatus,
        u.role as role,
        o.id as ownerId,
        o.address as address,
        o.lot_number as lot_number,
        o.phone as phone,
        o.phones as phones,
        o.created_at as created_at
      FROM users u
      LEFT JOIN owners o ON u.email = o.email

      UNION

      SELECT
        COALESCE(u.email, o.email) as email,
        COALESCE(u.name, o.name) as name,
        u.id as userId,
        u.status as accountStatus,
        u.role as role,
        o.id as ownerId,
        o.address as address,
        o.lot_number as lot_number,
        o.phone as phone,
        o.phones as phones,
        o.created_at as created_at
      FROM owners o
      LEFT JOIN users u ON o.email = u.email
    )
    ORDER BY
      CASE WHEN address IS NULL THEN 1 ELSE 0 END,
      address ASC,
      name ASC
    LIMIT ? OFFSET ?
  `;

  try {
    const result = await db.prepare(query).bind(limit, offset).all<{
      email: string;
      name: string | null;
      userId: string | null;
      accountStatus: string | null;
      role: string | null;
      ownerId: string | null;
      address: string | null;
      lot_number: string | null;
      phone: string | null;
      phones: string | null;
      created_at: string | null;
    }>();

    if (!result.success) {
      console.error('[MEMBERS-DB] Query failed:', result.error);
      throw new Error(`Database query failed: ${result.error || 'Unknown error'}`);
    }

    return (result.results || []).map(row => ({
      email: row.email,
      name: row.name,
      hasAccount: !!row.userId,
      accountStatus: row.accountStatus as 'active' | 'pending_setup' | 'suspended' | null,
      role: row.role,
      userId: row.userId,
      inDirectory: !!row.ownerId,
      ownerId: row.ownerId,
      address: row.address,
      lot_number: row.lot_number,
      phone: row.phone,
      phones: row.phones,
      created_at: row.created_at,
      updated_at: null,
    }));
  } catch (error) {
    console.error('[MEMBERS-DB] listAllMembers error:', error);
    console.error('[MEMBERS-DB] Query:', query);
    console.error('[MEMBERS-DB] Params:', { limit, offset });
    throw error;
  }
}

/**
 * Get a single member by email
 */
export async function getMemberByEmail(
  db: D1Database,
  email: string
): Promise<UnifiedMember | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const userQuery = `SELECT id, email, name, role, status, created FROM users WHERE email = ?`;
  const ownerQuery = `SELECT id, email, name, address, lot_number, phone, phones, created_at FROM owners WHERE email = ?`;

  const [userResult, ownerResult] = await Promise.all([
    db.prepare(userQuery).bind(normalizedEmail).first<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      status: string;
      created: string;
    }>(),
    db.prepare(ownerQuery).bind(normalizedEmail).first<{
      id: string;
      email: string;
      name: string | null;
      address: string | null;
      lot_number: string | null;
      phone: string | null;
      phones: string | null;
      created_at: string;
    }>()
  ]);

  // If neither exists, return null
  if (!userResult && !ownerResult) {
    return null;
  }

  return {
    email: normalizedEmail,
    name: userResult?.name || ownerResult?.name || null,
    hasAccount: !!userResult,
    accountStatus: (userResult?.status as 'active' | 'pending_setup' | 'suspended') || null,
    role: userResult?.role || null,
    userId: userResult?.id || null,
    inDirectory: !!ownerResult,
    ownerId: ownerResult?.id || null,
    address: ownerResult?.address || null,
    lot_number: ownerResult?.lot_number || null,
    phone: ownerResult?.phone || null,
    phones: ownerResult?.phones || null,
    created_at: userResult?.created || ownerResult?.created_at || null,
    updated_at: null,
  };
}

/**
 * Count total members (unique emails across both tables)
 */
export async function countMembers(db: D1Database): Promise<number> {
  const query = `
    SELECT COUNT(DISTINCT email) as count FROM (
      SELECT email FROM users
      UNION
      SELECT email FROM owners
    )
  `;

  const result = await db.prepare(query).first<{ count: number }>();
  return result?.count || 0;
}

/**
 * Get statistics about members
 */
export async function getMemberStats(db: D1Database) {
  const [
    totalMembers,
    withAccounts,
    inDirectory,
    activeAccounts,
    pendingAccounts,
  ] = await Promise.all([
    countMembers(db),
    db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM owners').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').bind('active').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').bind('pending_setup').first<{ count: number }>(),
  ]);

  return {
    total: totalMembers,
    withAccounts: withAccounts?.count || 0,
    inDirectory: inDirectory?.count || 0,
    activeAccounts: activeAccounts?.count || 0,
    pendingAccounts: pendingAccounts?.count || 0,
    accountOnlyCount: Math.max(0, (withAccounts?.count || 0) - (inDirectory?.count || 0)),
    directoryOnlyCount: Math.max(0, (inDirectory?.count || 0) - (withAccounts?.count || 0)),
  };
}
