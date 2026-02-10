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

/** Parse phones JSON to array. Falls back to single phone if phones column missing. */
export function getPhonesArray(owner: Owner): string[] {
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

const OWNERS_SELECT_FULL = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members FROM owners';
const OWNERS_SELECT_FULL_LOT = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members, lot_number FROM owners';
const OWNERS_SELECT_FULL_WITH_PRIMARY = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members, COALESCE(is_primary, 1) as is_primary, lot_number FROM owners';
const OWNERS_SELECT_FULL_WITH_UPDATED = 'SELECT id, name, address, phone, email, phones, created_by_email, share_contact_with_members, COALESCE(is_primary, 1) as is_primary, updated_by, updated_at, lot_number FROM owners';
const OWNERS_SELECT = 'SELECT id, name, address, phone, email, phones FROM owners';

export async function listOwners(db: D1Database, limit = LIST_OWNERS_MAX, offset = 0): Promise<Owner[]> {
  const safeLimit = Math.max(1, Math.min(limit, LIST_OWNERS_MAX));
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(`${OWNERS_SELECT_FULL_WITH_UPDATED} ORDER BY name ASC LIMIT ? OFFSET ?`)
      .bind(safeLimit, safeOffset)
      .all<Owner>();
    return results ?? [];
  } catch {
    try {
      const { results } = await db
        .prepare(`${OWNERS_SELECT_FULL_WITH_PRIMARY} ORDER BY name ASC LIMIT ? OFFSET ?`)
        .bind(safeLimit, safeOffset)
        .all<Owner>();
      return (results ?? []).map((o) => ({ ...o, updated_by: null, updated_at: null }));
    } catch {
      const { results } = await db
        .prepare(`${OWNERS_SELECT_FULL} ORDER BY name ASC LIMIT ? OFFSET ?`)
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
  createdByEmail?: string | null
): Promise<string> {
  const id = generateId();
  const creator = createdByEmail?.trim()?.toLowerCase() ?? null;
  const lotNumber = data.lot_number?.trim() || null;
  if (creator) {
    try {
      await db
        .prepare(
          `INSERT INTO owners (id, name, address, lot_number, phone, email, phones, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          data.name?.trim() ?? null,
          data.address?.trim() ?? null,
          lotNumber,
          data.phone?.trim() ?? null,
          data.email?.trim()?.toLowerCase() ?? null,
          data.phones ?? null,
          creator
        )
        .run();
      return id;
    } catch {
      /* lot_number column may not exist */
      await db
        .prepare(
          `INSERT INTO owners (id, name, address, phone, email, phones, created_by_email) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          data.name?.trim() ?? null,
          data.address?.trim() ?? null,
          data.phone?.trim() ?? null,
          data.email?.trim()?.toLowerCase() ?? null,
          data.phones ?? null,
          creator
        )
        .run();
      return id;
    }
  }
  try {
    await db
      .prepare(
        `INSERT INTO owners (id, name, address, lot_number, phone, email, phones) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.name?.trim() ?? null,
        data.address?.trim() ?? null,
        lotNumber,
        data.phone?.trim() ?? null,
        data.email?.trim()?.toLowerCase() ?? null,
        data.phones ?? null
      )
      .run();
    return id;
  } catch {
    await db
      .prepare(
        `INSERT INTO owners (id, name, address, phone, email, phones) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.name?.trim() ?? null,
        data.address?.trim() ?? null,
        data.phone?.trim() ?? null,
        data.email?.trim()?.toLowerCase() ?? null,
        data.phones ?? null
      )
      .run();
    return id;
  }
}

export async function updateOwner(
  db: D1Database,
  id: string,
  data: { name?: string | null; address?: string | null; lot_number?: string | null; phone?: string | null; email?: string | null; phones?: string | null; is_primary?: number | null },
  updatedByEmail?: string | null
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
  const updatedBy = updatedByEmail?.trim()?.toLowerCase() ?? null;
  if (updatedBy) {
    try {
      const result = await db
        .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phone = ?, email = ?, phones = ?, is_primary = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(name, address, lotNumber, phone, email, phones ?? null, isPrimary, updatedBy, id)
        .run();
      if ((result.meta.changes ?? 0) > 0) return true;
    } catch {
      try {
        const result = await db
          .prepare(`UPDATE owners SET name = ?, address = ?, phone = ?, email = ?, phones = ?, is_primary = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(name, address, phone, email, phones ?? null, isPrimary, updatedBy, id)
          .run();
        if ((result.meta.changes ?? 0) > 0) return true;
      } catch {
        /* updated_by column may not exist */
      }
    }
  }
  try {
    const result = await db
      .prepare(`UPDATE owners SET name = ?, address = ?, lot_number = ?, phone = ?, email = ?, phones = ?, is_primary = ? WHERE id = ?`)
      .bind(name, address, lotNumber, phone, email, phones ?? null, isPrimary, id)
      .run();
    return (result.meta.changes ?? 0) > 0;
  } catch {
    const result = await db
      .prepare(`UPDATE owners SET name = ?, address = ?, phone = ?, email = ?, phones = ?, is_primary = ? WHERE id = ?`)
      .bind(name, address, phone, email, phones ?? null, isPrimary, id)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }
}

export async function deleteOwner(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM owners WHERE id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Delete multiple owners by id. Returns number of rows deleted. */
export async function deleteOwners(db: D1Database, ids: string[]): Promise<number> {
  const unique = [...new Set(ids)].filter((id) => id?.trim());
  if (unique.length === 0) return 0;
  let deleted = 0;
  for (const id of unique) {
    const ok = await deleteOwner(db, id);
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
