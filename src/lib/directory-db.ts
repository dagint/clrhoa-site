/**
 * D1 helpers for Phase 3: Homeowner directory (owners + directory_logs).
 */

const ID_LEN = 21;

function generateId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  const bytes = new Uint8Array(ID_LEN);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < ID_LEN; i++) id += chars[bytes[i]! % chars.length];
  } else {
    for (let i = 0; i < ID_LEN; i++) id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export interface Owner {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  phones: string | null; // JSON array of phone strings
  /** Set when added via board directory (audit). */
  created_by_email?: string | null;
  /** 1 = share with other members (default), 0 = opt out (Board/ARB/Admin can still see; reveals are audited). */
  share_contact_with_members?: number | null;
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
const OWNERS_SELECT = 'SELECT id, name, address, phone, email, phones FROM owners';

export async function listOwners(db: D1Database): Promise<Owner[]> {
  try {
    const { results } = await db
      .prepare(`${OWNERS_SELECT_FULL} ORDER BY name ASC LIMIT ?`)
      .bind(LIST_OWNERS_MAX)
      .all<Owner>();
    return results ?? [];
  } catch {
    const { results } = await db
      .prepare(`${OWNERS_SELECT} ORDER BY name ASC LIMIT ?`)
      .bind(LIST_OWNERS_MAX)
      .all<Owner>();
    return results ?? [];
  }
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
    const row = await db.prepare(`${OWNERS_SELECT_FULL} WHERE id = ?`).bind(id).first<Owner>();
    return row;
  } catch {
    return db.prepare(`${OWNERS_SELECT} WHERE id = ?`).bind(id).first<Owner>();
  }
}

/** Get owners by ids (for resolving emails before delete). Returns only those that exist. */
export async function getOwnersByIds(db: D1Database, ids: string[]): Promise<Owner[]> {
  const unique = [...new Set(ids)].filter((id) => id?.trim());
  if (unique.length === 0) return [];
  const placeholders = unique.map(() => '?').join(',');
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

export async function getOwnerByEmail(db: D1Database, email: string): Promise<Owner | null> {
  try {
    return await db.prepare(`${OWNERS_SELECT_FULL} WHERE email = ?`).bind(email.trim().toLowerCase()).first<Owner>();
  } catch {
    return db.prepare(`${OWNERS_SELECT} WHERE email = ?`).bind(email.trim().toLowerCase()).first<Owner>();
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
}

/** List directory reveal logs (audit). Requires directory_logs table with optional viewer_role column. */
export async function listDirectoryLogs(db: D1Database, limit: number): Promise<DirectoryLogRow[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, viewer_email, viewer_role, target_name, target_phone, target_email, timestamp
         FROM directory_logs ORDER BY timestamp DESC LIMIT ?`
      )
      .bind(Math.max(1, Math.min(limit, 2000)))
      .all<DirectoryLogRow>();
    return results ?? [];
  } catch {
    try {
      const { results } = await db
        .prepare(
          `SELECT id, viewer_email, target_name, target_phone, target_email, timestamp
           FROM directory_logs ORDER BY timestamp DESC LIMIT ?`
        )
        .bind(Math.max(1, Math.min(limit, 2000)))
        .all<DirectoryLogRow & { viewer_role?: string | null }>();
      return (results ?? []).map((r) => ({ ...r, viewer_role: null }));
    } catch {
      return [];
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
  viewerRole?: string | null
): Promise<void> {
  const id = generateId();
  const viewer = viewerEmail.trim().toLowerCase();
  const name = targetName ?? '';
  const phone = targetPhone ?? '';
  const role = viewerRole?.trim() ?? null;

  if (targetEmail !== undefined && targetEmail !== null && targetEmail.trim() !== '') {
    try {
      await db
        .prepare(
          `INSERT INTO directory_logs (id, viewer_email, viewer_role, target_name, target_phone, target_email, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, viewer, role, name, phone, targetEmail.trim())
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
    return;
  }

  try {
    await db
      .prepare(
        `INSERT INTO directory_logs (id, viewer_email, viewer_role, target_name, target_phone, timestamp)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(id, viewer, role, name, phone)
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

/** Log a single audit entry when an elevated user exports the full directory (emails and phones). One log per export, not per member. */
export async function insertDirectoryExportLog(
  db: D1Database,
  viewerEmail: string,
  viewerRole: string | null
): Promise<void> {
  const id = generateId();
  const viewer = viewerEmail.trim().toLowerCase();
  const role = viewerRole?.trim() ?? null;
  const sentinel = '(full directory export)';
  try {
    await db
      .prepare(
        `INSERT INTO directory_logs (id, viewer_email, viewer_role, target_name, target_phone, timestamp)
         VALUES (?, ?, ?, ?, '', datetime('now'))`
      )
      .bind(id, viewer, role, sentinel)
      .run();
  } catch {
    await db
      .prepare(
        `INSERT INTO directory_logs (id, viewer_email, target_name, target_phone, timestamp)
         VALUES (?, ?, ?, '', datetime('now'))`
      )
      .bind(id, viewer, sentinel)
      .run();
  }
}

export async function insertOwner(
  db: D1Database,
  data: { name: string | null; address: string | null; phone: string | null; email: string | null; phones?: string | null },
  createdByEmail?: string | null
): Promise<string> {
  const id = generateId();
  const creator = createdByEmail?.trim()?.toLowerCase() ?? null;
  if (creator) {
    try {
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
    } catch {
      /* column may not exist */
    }
  }
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

export async function updateOwner(
  db: D1Database,
  id: string,
  data: { name?: string | null; address?: string | null; phone?: string | null; email?: string | null; phones?: string | null }
): Promise<boolean> {
  const existing = await getOwnerById(db, id);
  if (!existing) return false;
  const name = data.name !== undefined ? (data.name?.trim() ?? null) : existing.name;
  const address = data.address !== undefined ? (data.address?.trim() ?? null) : existing.address;
  const phone = data.phone !== undefined ? (data.phone?.trim() ?? null) : existing.phone;
  const email = data.email !== undefined ? (data.email?.trim()?.toLowerCase() ?? null) : existing.email;
  const phones = data.phones !== undefined ? data.phones : existing.phones;
  const result = await db
    .prepare(`UPDATE owners SET name = ?, address = ?, phone = ?, email = ?, phones = ? WHERE id = ?`)
    .bind(name, address, phone, email, phones ?? null, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
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
  data: { name?: string | null; address?: string | null; phones?: string | null; share_contact_with_members?: number | null }
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const existing = await getOwnerByEmail(db, normalized);
  if (!existing) return false;
  const name = data.name !== undefined ? (data.name?.trim() ?? null) : existing.name;
  const address = data.address !== undefined ? (data.address?.trim() ?? null) : existing.address;
  const phones = data.phones !== undefined ? data.phones : existing.phones;
  const phone = existing.phone;
  const shareContact = data.share_contact_with_members !== undefined ? data.share_contact_with_members : existing.share_contact_with_members;
  try {
    const result = await db
      .prepare(`UPDATE owners SET name = ?, address = ?, phones = ?, share_contact_with_members = ? WHERE email = ?`)
      .bind(name, address, phones ?? null, shareContact ?? 1, normalized)
      .run();
    return (result.meta.changes ?? 0) > 0;
  } catch {
    const result = await db
      .prepare(`UPDATE owners SET name = ?, address = ?, phones = ? WHERE email = ?`)
      .bind(name, address, phones ?? null, normalized)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }
}

/** Upsert owner for the given email (member updating their own info). Creates row if none. */
export async function upsertOwnerByEmail(
  db: D1Database,
  email: string,
  data: { name?: string | null; address?: string | null; phones?: string | null }
): Promise<{ id: string; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await getOwnerByEmail(db, normalized);
  if (existing) {
    const name = data.name !== undefined ? (data.name?.trim() ?? null) : existing.name;
    const address = data.address !== undefined ? (data.address?.trim() ?? null) : existing.address;
    const phones = data.phones !== undefined ? data.phones : existing.phones;
    await db
      .prepare(`UPDATE owners SET name = ?, address = ?, phones = ? WHERE email = ?`)
      .bind(name, address, phones ?? null, normalized)
      .run();
    return { id: existing.id, created: false };
  }
  const id = generateId();
  const name = data.name?.trim() ?? null;
  const address = data.address?.trim() ?? null;
  const phones = data.phones ?? null;
  await db
    .prepare(`INSERT INTO owners (id, name, address, phone, email, phones) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, name, address, null, normalized, phones)
    .run();
  return { id, created: true };
}
