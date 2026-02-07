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
}

export async function listVendors(db: D1Database): Promise<Vendor[]> {
  const { results } = await db
    .prepare('SELECT id, name, category, phone, email, website, notes, files, created FROM vendors ORDER BY category ASC, name ASC')
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
    .prepare('SELECT id, name, category, phone, email, website, notes, files, created FROM vendors WHERE id = ?')
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
  }
): Promise<string> {
  const id = generateId();
  await db
    .prepare(
      `INSERT INTO vendors (id, name, category, phone, email, website, notes, files) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      data.name?.trim() ?? null,
      data.category?.trim() ?? null,
      data.phone?.trim() ?? null,
      data.email?.trim()?.toLowerCase() ?? null,
      data.website?.trim() ?? null,
      data.notes?.trim() ?? null,
      data.filesJson ?? '[]'
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
  }
): Promise<boolean> {
  const existing = await getVendorById(db, id);
  if (!existing) return false;
  const result = await db
    .prepare(
      `UPDATE vendors SET name = ?, category = ?, phone = ?, email = ?, website = ?, notes = ?, files = ? WHERE id = ?`
    )
    .bind(
      data.name !== undefined ? (data.name?.trim() ?? null) : existing.name,
      data.category !== undefined ? (data.category?.trim() ?? null) : existing.category,
      data.phone !== undefined ? (data.phone?.trim() ?? null) : existing.phone,
      data.email !== undefined ? (data.email?.trim()?.toLowerCase() ?? null) : existing.email,
      data.website !== undefined ? (data.website?.trim() ?? null) : existing.website,
      data.notes !== undefined ? (data.notes?.trim() ?? null) : existing.notes,
      data.filesJson !== undefined ? data.filesJson : existing.files,
      id
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteVendor(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM vendors WHERE id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}
