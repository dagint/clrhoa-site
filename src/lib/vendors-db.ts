/**
 * D1 helpers for Phase 3: Recommended vendors.
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

export interface VendorFile {
  name: string;
  key: string;
}

const VENDOR_SELECT =
  'id, name, category, phone, email, website, notes, files, created, COALESCE(show_on_public, 1) as show_on_public';

export interface Vendor {
  id: string;
  name: string | null;
  category: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  files: string; // JSON array of { name, key }
  created: string | null;
  show_on_public: number;
}

export async function listVendors(db: D1Database): Promise<Vendor[]> {
  const { results } = await db
    .prepare(`SELECT ${VENDOR_SELECT} FROM vendors ORDER BY category ASC, name ASC`)
    .all<Vendor>();
  return results ?? [];
}

/** Vendors visible on the public Resources page (show_on_public = 1 only). */
export async function listPublicVendors(db: D1Database): Promise<Vendor[]> {
  const { results } = await db
    .prepare(
      `SELECT ${VENDOR_SELECT} FROM vendors WHERE COALESCE(show_on_public, 1) = 1 ORDER BY category ASC, name ASC`
    )
    .all<Vendor>();
  return results ?? [];
}

/** All vendors visible in the member portal (both “public & portal” and “portal only”). */
export async function listPortalVendors(db: D1Database): Promise<Vendor[]> {
  const { results } = await db
    .prepare(`SELECT ${VENDOR_SELECT} FROM vendors ORDER BY category ASC, name ASC`)
    .all<Vendor>();
  return results ?? [];
}

/** Count vendors added in the last N days (based on created). */
export async function getRecentVendorsCount(db: D1Database, days: number): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as n FROM vendors WHERE created >= date('now', ?)`
    )
    .bind(`-${days} days`)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getVendorById(db: D1Database, id: string): Promise<Vendor | null> {
  return db
    .prepare(`SELECT ${VENDOR_SELECT} FROM vendors WHERE id = ?`)
    .bind(id)
    .first<Vendor>();
}

export async function insertVendor(
  db: D1Database,
  data: {
    name: string | null;
    category: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    notes: string | null;
    filesJson?: string;
    show_on_public?: number;
  }
): Promise<string> {
  const id = generateId();
  const showOnPublic = data.show_on_public !== undefined ? (data.show_on_public ? 1 : 0) : 1;
  await db
    .prepare(
      `INSERT INTO vendors (id, name, category, phone, email, website, notes, files, show_on_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      data.name?.trim() ?? null,
      data.category?.trim() ?? null,
      data.phone?.trim() ?? null,
      data.email?.trim()?.toLowerCase() ?? null,
      data.website?.trim() ?? null,
      data.notes?.trim() ?? null,
      data.filesJson ?? '[]',
      showOnPublic
    )
    .run();
  return id;
}

export async function updateVendor(
  db: D1Database,
  id: string,
  data: {
    name?: string | null;
    category?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    notes?: string | null;
    filesJson?: string;
    show_on_public?: number;
  }
): Promise<boolean> {
  const existing = await getVendorById(db, id);
  if (!existing) return false;
  const showOnPublic =
    data.show_on_public !== undefined ? (data.show_on_public ? 1 : 0) : existing.show_on_public;
  const result = await db
    .prepare(
      `UPDATE vendors SET name = ?, category = ?, phone = ?, email = ?, website = ?, notes = ?, files = ?, show_on_public = ? WHERE id = ?`
    )
    .bind(
      data.name !== undefined ? (data.name?.trim() ?? null) : existing.name,
      data.category !== undefined ? (data.category?.trim() ?? null) : existing.category,
      data.phone !== undefined ? (data.phone?.trim() ?? null) : existing.phone,
      data.email !== undefined ? (data.email?.trim()?.toLowerCase() ?? null) : existing.email,
      data.website !== undefined ? (data.website?.trim() ?? null) : existing.website,
      data.notes !== undefined ? (data.notes?.trim() ?? null) : existing.notes,
      data.filesJson !== undefined ? data.filesJson : existing.files,
      showOnPublic,
      id
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteVendor(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM vendors WHERE id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export interface VendorAuditLogRow {
  id: number;
  vendor_id: string;
  vendor_name: string | null;
  action: string;
  done_by_email: string | null;
  created: string | null;
  ip_address: string | null;
}

export async function insertVendorAuditLog(
  db: D1Database,
  params: { vendor_id: string; vendor_name?: string | null; action: string; done_by_email?: string | null; ip_address?: string | null }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO vendor_audit_log (vendor_id, vendor_name, action, done_by_email, ip_address) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        params.vendor_id,
        params.vendor_name?.trim() ?? null,
        params.action,
        params.done_by_email?.trim()?.toLowerCase() ?? null,
        params.ip_address?.trim() ?? null
      )
      .run();
  } catch {
    /* table may not exist yet */
  }
}

export async function listVendorAuditLog(db: D1Database, limit: number, offset = 0): Promise<VendorAuditLogRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(
        `SELECT id, vendor_id, vendor_name, action, done_by_email, created, ip_address
         FROM vendor_audit_log ORDER BY created DESC LIMIT ? OFFSET ?`
      )
      .bind(safeLimit, safeOffset)
      .all<VendorAuditLogRow>();
    return (results ?? []).map((r) => ({ ...r, ip_address: r.ip_address ?? null }));
  } catch {
    return [];
  }
}
