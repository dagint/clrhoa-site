/**
 * D1 helpers for Phase 3: Homeowner directory (owners + directory_logs).
 */

import { generateId } from '../utils/id-generator.js';

export interface Owner {
  id: string;
  name: string | null;
  address: string | null;
  /** Lot number: 1–25. Required for elevated role. */
  lot_number?: string | null;
  phone: string | null;
  email: string | null;
  phones: string | null; // JSON array of phone strings
  /** Set when added via board directory (audit). */
  created_by_email?: string | null;
  /** 1 = share with other members (default), 0 = opt out (Board/ARB/Admin can still see; reveals are audited). */
  share_contact_with_members?: number | null;
  /** 1 = primary contact for this property (one per address for dues/assessments). Default 1. */
  is_primary?: number | null;
  /** Board or ARB leadership title (President, Vice President, Secretary, Treasurer, Member at Large, ARB Chair, ARB Member). */
  board_title?: string | null;
  /** Set when board updates owner (audit). */
  updated_by?: string | null;
  updated_at?: string | null;
}

/** Validation: lot number must be 1–25. Required for elevated role. */
export function validateLotNumber(lot: string | null | undefined): boolean {
  if (lot == null || typeof lot !== 'string') return false;
  const t = lot.trim();
  const n = parseInt(t, 10);
  return Number.isInteger(n) && n >= 1 && n <= 25;
}

/** Normalize address for grouping (trim, lowercase). */
export function normalizeAddress(addr: string | null | undefined): string {
  return (addr ?? '').trim().toLowerCase() || '';
}

/** Parse phones JSON to array. Falls back to single phone if phones column missing. Accepts any object with phone/phones fields. */
export function getPhonesArray(owner: { phone?: string | null; phones?: string | null }): string[] {
  if (owner.phones) {
    try {
      const arr = JSON.parse(owner.phones) as unknown;
      if (Array.isArray(arr)) return arr.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    } catch {
      // ignore
    }
  }
  if (owner.phone?.trim()) return [owner.phone.trim()];
  return [];
}

/** Maximum directory size returned in one call. Prevents unbounded queries at scale. */
export const LIST_OWNERS_MAX = 2000;

const OWNERS_SELECT_FULL = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members, board_title FROM owners';
const OWNERS_SELECT_FULL_LOT = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members, lot_number, board_title FROM owners';
const OWNERS_SELECT_FULL_WITH_PRIMARY = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members, COALESCE(is_primary, 1) as is_primary, lot_number, board_title FROM owners';
const OWNERS_SELECT_FULL_WITH_UPDATED = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members, COALESCE(is_primary, 1) as is_primary, updated_by, updated_at, lot_number, board_title FROM owners';
const OWNERS_SELECT = 'SELECT id, name, address, phone, email, phones, board_title FROM owners';

export async function listOwners(db: D1Database, limit = LIST_OWNERS_MAX, offset = 0): Promise<Owner[]> {
  const safeLimit = Math.max(1, Math.min(limit, LIST_OWNERS_MAX));
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(`${OWNERS_SELECT_FULL_WITH_UPDATED} ORDER BY CASE WHEN address IS NULL THEN 1 ELSE 0 END, address ASC, name ASC LIMIT ? OFFSET ?`)
      .bind(safeLimit, safeOffset)
      .all<Owner>();
    return results ?? [];
  } catch {
    try {
      const { results } = await db
        .prepare(`${OWNERS_SELECT_FULL_WITH_PRIMARY} ORDER BY CASE WHEN address IS NULL THEN 1 ELSE 0 END, address ASC, name ASC LIMIT ? OFFSET ?`)
        .bind(safeLimit, safeOffset)
        .all<Owner>();
      return (results ?? []).map((o) => ({ ...o, updated_by: null, updated_at: null }));
    } catch {
      const { results } = await db
        .prepare(`${OWNERS_SELECT_FULL} ORDER BY CASE WHEN address IS NULL THEN 1 ELSE 0 END, address ASC, name ASC LIMIT ? OFFSET ?`)
        .bind(safeLimit, safeOffset)
        .all<Owner>();
      return (results ?? []).map((o) => ({ ...o, updated_by: null, updated_at: null }));
    }
  }
}

/**
 * Count total number of owners in the database.
 * Used for pagination calculations.
 */
export async function countOwners(db: D1Database): Promise<number> {
  try {
    const result = await db
      .prepare('SELECT COUNT(*) as count FROM owners')
      .first<{ count: number }>();
    return result?.count ?? 0;
  } catch (e) {
    console.error('[directory-db] Failed to count owners:', e);
    return 0;
  }
}

/**
 * One primary owner per property (address) for dues/assessments. Groups by normalized address and returns
 * the primary contact (is_primary = 1) or the first owner at that address. Use this for the board
 * assessments spreadsheet so there is one row per address.
 */
export async function listPrimaryOwnersByAddress(db: D1Database): Promise<Owner[]> {
  const owners = await listOwners(db);
  const byAddress = new Map<string, Owner[]>();
  for (const o of owners) {
    const key = normalizeAddress(o.address);
    if (!key) continue;
    if (!byAddress.has(key)) byAddress.set(key, []);
    byAddress.get(key)!.push(o);
  }
  const result: Owner[] = [];
  for (const group of byAddress.values()) {
    const primary = group.find((o) => (o.is_primary ?? 1) === 1) ?? group[0];
    if (primary) result.push(primary);
  }
  return result.sort((a, b) => ((a.name ?? a.email ?? '').toLowerCase()).localeCompare((b.name ?? b.email ?? '').toLowerCase()));
}

/** Get the primary owner's email for an address (for looking up assessment by address). */
export async function getPrimaryOwnerEmailForAddress(db: D1Database, address: string | null | undefined): Promise<string | null> {
  const key = normalizeAddress(address);
  if (!key) return null;
  const owners = await listOwners(db);
  const atAddress = owners.filter((o) => normalizeAddress(o.address) === key);
  const primary = atAddress.find((o) => (o.is_primary ?? 1) === 1) ?? atAddress[0];
  return primary?.email?.trim() ?? null;
}

/**
 * All owner emails at the same (normalized) address as the given email. Includes the given email.
 * Used for household-scoped access (e.g. ARB requests: everyone at the address can see/interact).
 */
export async function listEmailsAtSameAddress(db: D1Database, email: string): Promise<string[]> {
  const owner = await getOwnerByEmail(db, email);
  if (!owner?.address?.trim()) return [email.trim().toLowerCase()];
  const key = normalizeAddress(owner.address);
  const owners = await listOwners(db);
  const atAddress = owners.filter((o) => normalizeAddress(o.address) === key);
  const emails = atAddress
    .map((o) => o.email?.trim()?.toLowerCase())
    .filter((e): e is string => !!e);
  return [...new Set(emails)];
}

export interface HouseholdMemberWithLogin {
  name: string | null;
  email: string;
  is_primary: number;
}

/**
 * List other owners at the same address as the given user who have portal login (user account).
 * Used on My account to show "others in your household who can sign in". Excludes the current user.
 */
export async function listHouseholdMembersWithLogin(
  db: D1Database,
  currentUserEmail: string
): Promise<HouseholdMemberWithLogin[]> {
  const current = currentUserEmail.trim().toLowerCase();
  const owner = await getOwnerByEmail(db, current);
  if (!owner?.address?.trim()) return [];

  const key = normalizeAddress(owner.address);
  const owners = await listOwners(db);
  const atAddress = owners.filter((o) => normalizeAddress(o.address) === key);
  const otherEmails = atAddress
    .map((o) => o.email?.trim()?.toLowerCase())
    .filter((e): e is string => !!e && e !== current);
  if (otherEmails.length === 0) return [];

  const placeholders = otherEmails.map(() => '?').join(',');
  const { results: userRows } = await db
    .prepare(`SELECT email FROM users WHERE email IN (${placeholders})`)
    .bind(...otherEmails)
    .all<{ email: string }>();
  const hasLogin = new Set((userRows ?? []).map((r) => r.email?.toLowerCase()).filter(Boolean));

  return atAddress
    .filter((o) => {
      const e = o.email?.trim()?.toLowerCase();
      return e && e !== current && hasLogin.has(e);
    })
    .map((o) => ({
      name: o.name?.trim() ?? null,
      email: o.email!.trim().toLowerCase(),
      is_primary: (o.is_primary ?? 1) === 1 ? 1 : 0,
    }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

/**
 * List ALL household members (directory entries) at the same address as current user.
 * Includes members regardless of whether they have portal accounts.
 * Returns name, email, phone(s), sharing status, and whether they have a portal account.
 */
export async function listAllHouseholdMembers(
  db: D1Database,
  currentUserEmail: string
): Promise<Array<{ name: string | null; email: string | null; phone: string | null; phones: string | null; hasAccount: boolean; is_primary: number; share_contact_with_members: number }>> {
  const current = currentUserEmail.trim().toLowerCase();
  const owner = await getOwnerByEmail(db, current);
  if (!owner?.address?.trim()) return [];

  const key = normalizeAddress(owner.address);
  const owners = await listOwners(db);
  const atAddress = owners.filter((o) => normalizeAddress(o.address) === key);

  // Get current user's email to exclude them
  const othersAtAddress = atAddress.filter((o) => {
    const e = o.email?.trim()?.toLowerCase();
    return !e || e !== current; // Include entries without email OR different email
  });

  if (othersAtAddress.length === 0) return [];

  // Check which ones have accounts
  const emailsToCheck = othersAtAddress
    .map((o) => o.email?.trim()?.toLowerCase())
    .filter((e): e is string => !!e);

  let hasLoginSet = new Set<string>();
  if (emailsToCheck.length > 0) {
    const placeholders = emailsToCheck.map(() => '?').join(',');
    const { results: userRows } = await db
      .prepare(`SELECT email FROM users WHERE email IN (${placeholders})`)
      .bind(...emailsToCheck)
      .all<{ email: string }>();
    hasLoginSet = new Set((userRows ?? []).map((r) => r.email?.toLowerCase()).filter(Boolean));
  }

  return othersAtAddress
    .map((o) => ({
      name: o.name?.trim() ?? null,
      email: o.email?.trim()?.toLowerCase() ?? null,
      phone: o.phone?.trim() ?? null,
      phones: o.phones ?? null,
      hasAccount: o.email ? hasLoginSet.has(o.email.trim().toLowerCase()) : false,
      is_primary: (o.is_primary ?? 1) === 1 ? 1 : 0,
      share_contact_with_members: (o.share_contact_with_members ?? 1) === 1 ? 1 : 0,
    }))
    .sort((a, b) => {
      const aName = a.name || a.email || '';
      const bName = b.name || b.email || '';
      return aName.localeCompare(bName);
    });
}

/** Count owners added in the last N days. Requires created_at column (run db:owners-created-at migration). Returns 0 if column missing. */
export async function getRecentOwnersCount(db: D1Database, days: number): Promise<number> {
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(*) as n FROM owners WHERE created_at >= date('now', ?)`
      )
      .bind(`-${days} days`)
      .first<{ n: number }>();
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function getOwnerById(db: D1Database, id: string): Promise<Owner | null> {
  try {
    const row = await db.prepare(`${OWNERS_SELECT_FULL_WITH_PRIMARY} WHERE id = ?`).bind(id).first<Owner>();
    return row ?? null;
  } catch {
    try {
      return await db.prepare(`${OWNERS_SELECT_FULL} WHERE id = ?`).bind(id).first<Owner>();
    } catch {
      return db.prepare(`${OWNERS_SELECT} WHERE id = ?`).bind(id).first<Owner>();
    }
  }
}

/** Get owners by ids (for resolving emails before delete). Returns only those that exist. */
export async function getOwnersByIds(db: D1Database, ids: string[]): Promise<Owner[]> {
  const unique = [...new Set(ids)].filter((id) => id?.trim());
  if (unique.length === 0) return [];
  const placeholders = unique.map(() => '?').join(',');
  try {
    const { results } = await db
      .prepare(`${OWNERS_SELECT_FULL_LOT} WHERE id IN (${placeholders})`)
      .bind(...unique)
      .all<Owner>();
    return results ?? [];
  } catch {
    try {
      const { results } = await db
        .prepare(`${OWNERS_SELECT_FULL} WHERE id IN (${placeholders})`)
        .bind(...unique)
        .all<Owner>();
      return results ?? [];
    } catch {
      const { results } = await db
        .prepare(`${OWNERS_SELECT} WHERE id IN (${placeholders})`)
        .bind(...unique)
        .all<Owner>();
      return results ?? [];
    }
  }
}

export async function getOwnerByEmail(db: D1Database, email: string): Promise<Owner | null> {
  try {
    return await db.prepare(`${OWNERS_SELECT_FULL_LOT} WHERE email = ?`).bind(email.trim().toLowerCase()).first<Owner>();
  } catch {
    try {
      return await db.prepare(`${OWNERS_SELECT_FULL} WHERE email = ?`).bind(email.trim().toLowerCase()).first<Owner>();
    } catch {
      return db.prepare(`${OWNERS_SELECT} WHERE email = ?`).bind(email.trim().toLowerCase()).first<Owner>();
    }
  }
}

export interface DirectoryLogRow {
  id: string;
  viewer_email: string | null;
  viewer_role: string | null;
  target_name: string | null;
  target_phone: string | null;
  target_email: string | null;
  timestamp: string | null;
  ip_address: string | null;
}

/** List directory reveal logs for a single viewer (their own actions). For portal "My activity" page. */
export async function listDirectoryLogsByViewer(
  db: D1Database,
  viewerEmail: string,
  limit: number,
  offset = 0
): Promise<DirectoryLogRow[]> {
  const viewer = viewerEmail.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(
        `SELECT id, viewer_email, viewer_role, target_name, target_phone, target_email, timestamp, ip_address
         FROM directory_logs WHERE viewer_email = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
      )
      .bind(viewer, safeLimit, safeOffset)
      .all<DirectoryLogRow>();
    return (results ?? []).map((r) => ({ ...r, ip_address: r.ip_address ?? null }));
  } catch {
    try {
      const { results } = await db
        .prepare(
          `SELECT id, viewer_email, target_name, target_phone, target_email, timestamp, ip_address
           FROM directory_logs WHERE viewer_email = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
        )
        .bind(viewer, safeLimit, safeOffset)
        .all<DirectoryLogRow & { viewer_role?: string | null }>();
      return (results ?? []).map((r) => ({ ...r, viewer_role: null, ip_address: r.ip_address ?? null }));
    } catch {
      try {
        const { results } = await db
          .prepare(
            `SELECT id, viewer_email, target_name, target_phone, target_email, timestamp
             FROM directory_logs WHERE viewer_email = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`
          )
          .bind(viewer, safeLimit, safeOffset)
          .all<DirectoryLogRow & { viewer_role?: string | null }>();
        return (results ?? []).map((r) => ({ ...r, viewer_role: null, ip_address: null }));
      } catch {
        return [];
      }
    }
  }
}

/** List directory reveal logs (audit). Requires directory_logs table with optional viewer_role column. */
export async function listDirectoryLogs(db: D1Database, limit: number, offset = 0): Promise<DirectoryLogRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 2000));
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(
        `SELECT id, viewer_email, viewer_role, target_name, target_phone, target_email, timestamp, ip_address
         FROM directory_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`
      )
      .bind(safeLimit, safeOffset)
      .all<DirectoryLogRow>();
    return (results ?? []).map((r) => ({ ...r, ip_address: r.ip_address ?? null }));
  } catch {
    try {
      const { results } = await db
        .prepare(
          `SELECT id, viewer_email, target_name, target_phone, target_email, timestamp, ip_address
           FROM directory_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`
        )
        .bind(safeLimit, safeOffset)
        .all<DirectoryLogRow & { viewer_role?: string | null }>();
      return (results ?? []).map((r) => ({ ...r, viewer_role: null, ip_address: r.ip_address ?? null }));
    } catch {
      try {
        const { results } = await db
          .prepare(
            `SELECT id, viewer_email, viewer_role, target_name, target_phone, target_email, timestamp
             FROM directory_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`
          )
          .bind(safeLimit, safeOffset)
          .all<DirectoryLogRow>();
        return (results ?? []).map((r) => ({ ...r, ip_address: null }));
      } catch {
        return [];
      }
    }
  }
}

/** Log a directory reveal (phone or email). Pass either targetPhone or targetEmail. viewerRole (e.g. board, arb, admin, member) is recorded for audit. */
export async function insertDirectoryLog(
  db: D1Database,
  viewerEmail: string,
  targetName: string | null,
  targetPhone: string | null,
  targetEmail?: string | null,
  viewerRole?: string | null,
  ipAddress?: string | null
): Promise<void> {
  const id = generateId();
  const viewer = viewerEmail.trim().toLowerCase();
  const name = targetName ?? '';
  const phone = targetPhone ?? '';
  const role = viewerRole?.trim() ?? null;
  const ip = ipAddress?.trim() ?? null;

  if (targetEmail !== undefined && targetEmail !== null && targetEmail.trim() !== '') {
    try {
      await db
        .prepare(
          `INSERT INTO directory_logs (id, viewer_email, viewer_role, target_name, target_phone, target_email, ip_address, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, viewer, role, name, phone, targetEmail.trim(), ip)
        .run();
    } catch {
      try {
        await db
          .prepare(
            `INSERT INTO directory_logs (id, viewer_email, target_name, target_phone, target_email, ip_address, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
          )
          .bind(id, viewer, name, phone, targetEmail.trim(), ip)
          .run();
      } catch {
        await db
          .prepare(
            `INSERT INTO directory_logs (id, viewer_email, target_name, target_phone, target_email, timestamp)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`
          )
          .bind(id, viewer, name, phone, targetEmail.trim())
          .run();
      }
    }
    return;
  }

  try {
    await db
      .prepare(
        `INSERT INTO directory_logs (id, viewer_email, viewer_role, target_name, target_phone, ip_address, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(id, viewer, role, name, phone, ip)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `INSERT INTO directory_logs (id, viewer_email, target_name, target_phone, ip_address, timestamp)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, viewer, name, phone, ip)
        .run();
    } catch {
      await db
        .prepare(
          `INSERT INTO directory_logs (id, viewer_email, target_name, target_phone, timestamp)
           VALUES (?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, viewer, name, phone)
        .run();
    }
  }
}

/** Log a single audit entry when an elevated user exports the full directory (emails and phones). One log per export, not per member. */
export async function insertDirectoryExportLog(
  db: D1Database,
  viewerEmail: string,
  viewerRole: string | null,
  ipAddress?: string | null
): Promise<void> {
  const id = generateId();
  const viewer = viewerEmail.trim().toLowerCase();
  const role = viewerRole?.trim() ?? null;
  const ip = ipAddress?.trim() ?? null;
  const sentinel = '(full directory export)';
  try {
    await db
      .prepare(
        `INSERT INTO directory_logs (id, viewer_email, viewer_role, target_name, target_phone, ip_address, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(id, viewer, role, sentinel, '', ip)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `INSERT INTO directory_logs (id, viewer_email, target_name, target_phone, ip_address, timestamp)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, viewer, sentinel, '', ip)
        .run();
    } catch {
      await db
        .prepare(
          `INSERT INTO directory_logs (id, viewer_email, target_name, target_phone, timestamp)
           VALUES (?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, viewer, sentinel, '')
        .run();
    }
  }
}

export async function insertOwner(
  db: D1Database,
  data: { name: string | null; address: string | null; lot_number?: string | null; phone: string | null; email: string | null; phones?: string | null },
  createdByEmail?: string | null,
  auditContext?: { ip_address?: string; role?: string; operation_type?: string }
): Promise<string> {
  const id = generateId();
  const creator = createdByEmail?.trim()?.toLowerCase() ?? null;
  const lotNumber = data.lot_number?.trim() || null;
  const normalizedEmail = data.email?.trim()?.toLowerCase() ?? null;
  const normalizedName = data.name?.trim() ?? null;

  if (creator) {
    try {
      await db
        .prepare(
          `INSERT INTO owners (id, name, address, lot_number, phone, email, phones, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          normalizedName,
          data.address?.trim() ?? null,
          lotNumber,
          data.phone?.trim() ?? null,
          normalizedEmail,
          data.phones ?? null,
          creator
        )
        .run();
    } catch {
      /* lot_number column may not exist */
      await db
        .prepare(
          `INSERT INTO owners (id, name, address, phone, email, phones, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          normalizedName,
          data.address?.trim() ?? null,
          data.phone?.trim() ?? null,
          normalizedEmail,
          data.phones ?? null,
          creator
        )
        .run();
    }
  } else {
    try {
      await db
        .prepare(
          `INSERT INTO owners (id, name, address, lot_number, phone, email, phones) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          normalizedName,
          data.address?.trim() ?? null,
          lotNumber,
          data.phone?.trim() ?? null,
          normalizedEmail,
          data.phones ?? null
        )
        .run();
    } catch {
      await db
        .prepare(
          `INSERT INTO owners (id, name, address, phone, email, phones) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          normalizedName,
          data.address?.trim() ?? null,
          data.phone?.trim() ?? null,
          normalizedEmail,
          data.phones ?? null
        )
        .run();
    }
  }

  // Audit log
  await insertOwnerAuditLog(db, {
    owner_id: id,
    owner_name: normalizedName,
    owner_email: normalizedEmail,
    action: auditContext?.operation_type === 'csv_upload' ? 'created_via_csv_upload' : 'created',
    changed_by_email: creator,
    changed_by_role: auditContext?.role ?? null,
    ip_address: auditContext?.ip_address ?? null,
    new_values: JSON.stringify(data),
    operation_type: auditContext?.operation_type ?? 'manual',
  });

  return id;
}

export async function updateOwner(
  db: D1Database,
  id: string,
  data: { name?: string | null; address?: string | null; lot_number?: string | null; phone?: string | null; email?: string | null; phones?: string | null; is_primary?: number | null; board_title?: string | null },
  updatedByEmail?: string | null,
  auditContext?: { ip_address?: string; role?: string; operation_type?: string }
): Promise<boolean> {
  const existing = await getOwnerById(db, id);
  if (!existing) return false;

  const name = data.name !== undefined ? (data.name?.trim() ?? null) : existing.name;
  const address = data.address !== undefined ? (data.address?.trim() ?? null) : existing.address;
  const lotNumber = data.lot_number !== undefined ? (data.lot_number?.trim() || null) : existing.lot_number ?? null;
  const phone = data.phone !== undefined ? (data.phone?.trim() ?? null) : existing.phone;
  const email = data.email !== undefined ? (data.email?.trim()?.toLowerCase() ?? null) : existing.email;
  const phones = data.phones !== undefined ? data.phones : existing.phones;
  const isPrimary = data.is_primary !== undefined ? (data.is_primary ? 1 : 0) : (existing.is_primary ?? 1);
  const boardTitle = data.board_title !== undefined ? (data.board_title?.trim() || null) : existing.board_title ?? null;
  const updatedBy = updatedByEmail?.trim()?.toLowerCase() ?? null;

  // Track changed fields for audit
  const changedFields: string[] = [];
  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};

  if (data.name !== undefined && name !== existing.name) {
    changedFields.push('name');
    oldValues.name = existing.name;
    newValues.name = name;
  }
  if (data.address !== undefined && address !== existing.address) {
    changedFields.push('address');
    oldValues.address = existing.address;
    newValues.address = address;
  }
  if (data.lot_number !== undefined && lotNumber !== existing.lot_number) {
    changedFields.push('lot_number');
    oldValues.lot_number = existing.lot_number;
    newValues.lot_number = lotNumber;
  }
  if (data.phone !== undefined && phone !== existing.phone) {
    changedFields.push('phone');
    oldValues.phone = existing.phone;
    newValues.phone = phone;
  }
  if (data.email !== undefined && email !== existing.email) {
    changedFields.push('email');
    oldValues.email = existing.email;
    newValues.email = email;
  }
  if (data.phones !== undefined && phones !== existing.phones) {
    changedFields.push('phones');
    oldValues.phones = existing.phones;
    newValues.phones = phones;
  }
  if (data.is_primary !== undefined && isPrimary !== (existing.is_primary ?? 1)) {
    changedFields.push('is_primary');
    oldValues.is_primary = existing.is_primary;
    newValues.is_primary = isPrimary;
  }
  if (data.board_title !== undefined && boardTitle !== (existing.board_title ?? null)) {
    changedFields.push('board_title');
    oldValues.board_title = existing.board_title;
    newValues.board_title = boardTitle;
  }

  let updated = false;
  if (updatedBy) {
    try {
      const result = await db
        .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phone = ?, email = ?, phones = ?, is_primary = ?, board_title = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(name, address, lotNumber, phone, email, phones ?? null, isPrimary, boardTitle, updatedBy, id)
        .run();
      if ((result.meta.changes ?? 0) > 0) updated = true;
    } catch {
      try {
        const result = await db
          .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phone = ?, email = ?, phones = ?, is_primary = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(name, address, lotNumber, phone, email, phones ?? null, isPrimary, updatedBy, id)
          .run();
        if ((result.meta.changes ?? 0) > 0) updated = true;
      } catch {
        try {
          const result = await db
            .prepare(`UPDATE owners SET name = ?, address = ?, phone = ?, email = ?, phones = ?, is_primary = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(name, address, phone, email, phones ?? null, isPrimary, updatedBy, id)
            .run();
          if ((result.meta.changes ?? 0) > 0) updated = true;
        } catch {
          /* updated_by column may not exist */
        }
      }
    }
  }

  if (!updated) {
    try {
      const result = await db
        .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phone = ?, email = ?, phones = ?, is_primary = ?, board_title = ? WHERE id = ?`)
        .bind(name, address, lotNumber, phone, email, phones ?? null, isPrimary, boardTitle, id)
        .run();
      updated = (result.meta.changes ?? 0) > 0;
    } catch {
      try {
        const result = await db
          .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phone = ?, email = ?, phones = ?, is_primary = ? WHERE id = ?`)
          .bind(name, address, lotNumber, phone, email, phones ?? null, isPrimary, id)
          .run();
        updated = (result.meta.changes ?? 0) > 0;
      } catch {
        const result = await db
          .prepare(`UPDATE owners SET name = ?, address = ?, phone = ?, email = ?, phones = ?, is_primary = ? WHERE id = ?`)
          .bind(name, address, phone, email, phones ?? null, isPrimary, id)
          .run();
        updated = (result.meta.changes ?? 0) > 0;
      }
    }
  }

  // Audit log if update was successful and fields changed
  if (updated && changedFields.length > 0) {
    await insertOwnerAuditLog(db, {
      owner_id: id,
      owner_name: name,
      owner_email: email,
      action: auditContext?.operation_type === 'csv_upload' ? 'updated_via_csv_upload' : 'updated',
      changed_by_email: updatedBy,
      changed_by_role: auditContext?.role ?? null,
      ip_address: auditContext?.ip_address ?? null,
      old_values: JSON.stringify(oldValues),
      new_values: JSON.stringify(newValues),
      fields_changed: changedFields.join(', '),
      operation_type: auditContext?.operation_type ?? 'manual',
    });
  }

  return updated;
}

export async function deleteOwner(
  db: D1Database,
  id: string,
  deletedByEmail?: string | null,
  auditContext?: { ip_address?: string; role?: string; operation_type?: string }
): Promise<boolean> {
  // Fetch owner data before deletion for audit log
  const existing = await getOwnerById(db, id);
  if (!existing) return false;

  const result = await db.prepare('DELETE FROM owners WHERE id = ?').bind(id).run();
  const deleted = (result.meta.changes ?? 0) > 0;

  // Audit log
  if (deleted) {
    await insertOwnerAuditLog(db, {
      owner_id: id,
      owner_name: existing.name,
      owner_email: existing.email,
      action: 'deleted',
      changed_by_email: deletedByEmail?.trim()?.toLowerCase() ?? null,
      changed_by_role: auditContext?.role ?? null,
      ip_address: auditContext?.ip_address ?? null,
      old_values: JSON.stringify({
        name: existing.name,
        address: existing.address,
        lot_number: existing.lot_number,
        phone: existing.phone,
        email: existing.email,
        phones: existing.phones,
      }),
      operation_type: auditContext?.operation_type ?? 'manual',
    });
  }

  return deleted;
}

/** Delete multiple owners by id. Returns number of rows deleted. */
export async function deleteOwners(
  db: D1Database,
  ids: string[],
  deletedByEmail?: string | null,
  auditContext?: { ip_address?: string; role?: string; operation_type?: string }
): Promise<number> {
  const unique = [...new Set(ids)].filter((id) => id?.trim());
  if (unique.length === 0) return 0;
  let deleted = 0;
  for (const id of unique) {
    const ok = await deleteOwner(db, id, deletedByEmail, auditContext);
    if (ok) deleted += 1;
  }
  return deleted;
}

/** Update the owner row for the given email (self-service). Returns true if updated. share_contact_with_members: 1 = allow other members to reveal, 0 = opt out (Board/ARB/Admin can still see). */
export async function updateOwnerByEmail(
  db: D1Database,
  email: string,
  data: { name?: string | null; address?: string | null; lot_number?: string | null; phones?: string | null; share_contact_with_members?: number | null }
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const existing = await getOwnerByEmail(db, normalized);
  if (!existing) return false;
  const name = data.name !== undefined ? (data.name?.trim() ?? null) : existing.name;
  const address = data.address !== undefined ? (data.address?.trim() ?? null) : existing.address;
  const lotNumber = data.lot_number !== undefined ? (data.lot_number?.trim() || null) : existing.lot_number ?? null;
  const phones = data.phones !== undefined ? data.phones : existing.phones;
  const shareContact = data.share_contact_with_members !== undefined ? data.share_contact_with_members : existing.share_contact_with_members;
  try {
    const result = await db
      .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phones = ?, share_contact_with_members = ? WHERE email = ?`)
      .bind(name, address, lotNumber, phones ?? null, shareContact ?? 1, normalized)
      .run();
    return (result.meta.changes ?? 0) > 0;
  } catch {
    const result = await db
      .prepare(`UPDATE owners SET name = ?, address = ?, phones = ?, share_contact_with_members = ? WHERE email = ?`)
      .bind(name, address, phones ?? null, shareContact ?? 1, normalized)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }
}

/** Upsert owner for the given email (member updating their own info). Creates row if none. */
export async function upsertOwnerByEmail(
  db: D1Database,
  email: string,
  data: { name?: string | null; address?: string | null; lot_number?: string | null; phones?: string | null }
): Promise<{ id: string; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await getOwnerByEmail(db, normalized);
  if (existing) {
    const name = data.name !== undefined ? (data.name?.trim() ?? null) : existing.name;
    const address = data.address !== undefined ? (data.address?.trim() ?? null) : existing.address;
    const lotNumber = data.lot_number !== undefined ? (data.lot_number?.trim() || null) : existing.lot_number ?? null;
    const phones = data.phones !== undefined ? data.phones : existing.phones;
    try {
      await db
        .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phones = ? WHERE email = ?`)
        .bind(name, address, lotNumber, phones ?? null, normalized)
        .run();
    } catch {
      await db
        .prepare(`UPDATE owners SET name = ?, address = ?, phones = ? WHERE email = ?`)
        .bind(name, address, phones ?? null, normalized)
        .run();
    }
    return { id: existing.id, created: false };
  }
  const id = generateId();
  const name = data.name?.trim() ?? null;
  const address = data.address?.trim() ?? null;
  const lotNumber = data.lot_number?.trim() || null;
  const phones = data.phones ?? null;
  try {
    await db
      .prepare(`INSERT INTO owners (id, name, address, lot_number, phone, email, phones) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, name, address, lotNumber, null, normalized, phones)
      .run();
  } catch {
    await db
      .prepare(`INSERT INTO owners (id, name, address, phone, email, phones) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, name, address, null, normalized, phones)
      .run();
  }
  return { id, created: true };
}

// ============================================================================
// OWNER AUDIT LOGGING
// ============================================================================

export interface OwnerAuditLogEntry {
  owner_id: string;
  owner_name?: string | null;
  owner_email?: string | null;
  action: string;
  changed_by_email?: string | null;
  changed_by_role?: string | null;
  ip_address?: string | null;
  old_values?: string | null;  // JSON
  new_values?: string | null;  // JSON
  fields_changed?: string | null;
  operation_type?: string | null;
  correlation_id?: string | null;
}

export interface OwnerAuditLogRow {
  id: number;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  action: string;
  changed_by_email: string | null;
  changed_by_role: string | null;
  ip_address: string | null;
  old_values: string | null;
  new_values: string | null;
  fields_changed: string | null;
  operation_type: string | null;
  correlation_id: string | null;
  created: string;
}

/**
 * Insert owner audit log entry
 * Tracks all owner/directory CRUD operations for HOA compliance
 */
export async function insertOwnerAuditLog(
  db: D1Database,
  params: OwnerAuditLogEntry
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO owner_audit_log (
          owner_id, owner_name, owner_email, action,
          changed_by_email, changed_by_role, ip_address,
          old_values, new_values, fields_changed,
          operation_type, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.owner_id,
        params.owner_name?.trim() ?? null,
        params.owner_email?.trim()?.toLowerCase() ?? null,
        params.action,
        params.changed_by_email?.trim()?.toLowerCase() ?? null,
        params.changed_by_role?.trim() ?? null,
        params.ip_address?.trim() ?? null,
        params.old_values ?? null,
        params.new_values ?? null,
        params.fields_changed ?? null,
        params.operation_type ?? null,
        params.correlation_id ?? null
      )
      .run();
  } catch (error) {
    // Table may not exist yet (migration not run)
    console.error('[DIRECTORY-DB] Failed to insert owner audit log:', error);
  }
}

/**
 * List owner audit log entries
 * For HOA compliance reporting and security audit
 */
export async function listOwnerAuditLog(
  db: D1Database,
  limit: number,
  offset = 0
): Promise<OwnerAuditLogRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(
        `SELECT
          id, owner_id, owner_name, owner_email, action,
          changed_by_email, changed_by_role, ip_address,
          old_values, new_values, fields_changed,
          operation_type, correlation_id, created
         FROM owner_audit_log
         ORDER BY created DESC
         LIMIT ? OFFSET ?`
      )
      .bind(safeLimit, safeOffset)
      .all<OwnerAuditLogRow>();
    return results ?? [];
  } catch {
    // Table may not exist yet
    return [];
  }
}

/**
 * Get audit log for specific owner
 */
export async function getOwnerAuditHistory(
  db: D1Database,
  ownerId: string,
  limit = 50
): Promise<OwnerAuditLogRow[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT
          id, owner_id, owner_name, owner_email, action,
          changed_by_email, changed_by_role, ip_address,
          old_values, new_values, fields_changed,
          operation_type, correlation_id, created
         FROM owner_audit_log
         WHERE owner_id = ?
         ORDER BY created DESC
         LIMIT ?`
      )
      .bind(ownerId, limit)
      .all<OwnerAuditLogRow>();
    return results ?? [];
  } catch {
    return [];
  }
}
