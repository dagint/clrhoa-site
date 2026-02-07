/**
 * D1 helpers for Phase 6: Architectural Pre-Approval Library.
 */

export interface PreapprovalItem {
  id: string;
  category: string | null;
  title: string | null;
  description: string | null;
  rules: string | null;
  photos: string | null;
  created_by: string | null;
  created: string;
}

export interface PreapprovalPhoto {
  name: string;
  key: string;
}

const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateId(len: number = 14): string {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < len; i++) id += ID_CHARS[bytes[i]! % ID_CHARS.length];
  return id;
}

export function createPreapprovalId(): string {
  return `pa_${generateId(12)}`;
}

export function parsePhotos(json: string | null): PreapprovalPhoto[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as { name?: string; key?: string }[];
    return Array.isArray(arr) ? arr.filter((f) => f && f.key).map((f) => ({ name: f.name ?? 'Image', key: f.key! })) : [];
  } catch {
    return [];
  }
}

/** List all items, optionally by category, newest first. */
export async function listPreapprovalItems(
  db: D1Database,
  options?: { category?: string | null }
): Promise<PreapprovalItem[]> {
  if (options?.category != null && options.category !== '') {
    const { results } = await db
      .prepare(
        'SELECT id, category, title, description, rules, photos, created_by, created FROM preapproval_items WHERE category = ? ORDER BY created DESC'
      )
      .bind(options.category)
      .all<PreapprovalItem>();
    return results ?? [];
  }
  const { results } = await db
    .prepare(
      'SELECT id, category, title, description, rules, photos, created_by, created FROM preapproval_items ORDER BY created DESC'
    )
    .all<PreapprovalItem>();
  return results ?? [];
}

/** Get distinct categories for filter tabs. */
export async function listPreapprovalCategories(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT category FROM preapproval_items WHERE category IS NOT NULL AND category != "" ORDER BY category')
    .all<{ category: string }>();
  return (results ?? []).map((r) => r.category);
}

/** Get one item by id. */
export async function getPreapprovalById(db: D1Database, id: string): Promise<PreapprovalItem | null> {
  return db
    .prepare(
      'SELECT id, category, title, description, rules, photos, created_by, created FROM preapproval_items WHERE id = ? LIMIT 1'
    )
    .bind(id)
    .first<PreapprovalItem>();
}

/** Search items by title, description, rules, category (for smart search). */
export async function searchPreapprovalItems(db: D1Database, like: string, limit = 20): Promise<PreapprovalItem[]> {
  const pattern = `%${like}%`;
  const { results } = await db
    .prepare(
      `SELECT id, category, title, description, rules, photos, created_by, created
       FROM preapproval_items
       WHERE title LIKE ? OR description LIKE ? OR rules LIKE ? OR category LIKE ?
       ORDER BY created DESC LIMIT ?`
    )
    .bind(pattern, pattern, pattern, pattern, limit)
    .all<PreapprovalItem>();
  return results ?? [];
}

/** Insert preapproval item. */
export async function insertPreapprovalItem(
  db: D1Database,
  id: string,
  data: {
    category: string | null;
    title: string;
    description: string | null;
    rules: string | null;
    photos: string | null;
    created_by: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO preapproval_items (id, category, title, description, rules, photos, created_by, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      data.category?.trim() || null,
      data.title.trim(),
      data.description?.trim() || null,
      data.rules?.trim() || null,
      data.photos ?? null,
      data.created_by
    )
    .run();
}

/** Update preapproval item. */
export async function updatePreapprovalItem(
  db: D1Database,
  id: string,
  data: {
    category?: string | null;
    title?: string;
    description?: string | null;
    rules?: string | null;
    photos?: string | null;
  }
): Promise<boolean> {
  const item = await getPreapprovalById(db, id);
  if (!item) return false;
  await db
    .prepare(
      `UPDATE preapproval_items SET
        category = COALESCE(?, category),
        title = COALESCE(?, title),
        description = ?,
        rules = ?,
        photos = COALESCE(?, photos)
       WHERE id = ?`
    )
    .bind(
      data.category !== undefined ? (data.category?.trim() || null) : item.category,
      data.title !== undefined ? data.title.trim() : item.title,
      data.description !== undefined ? (data.description?.trim() || null) : item.description,
      data.rules !== undefined ? (data.rules?.trim() || null) : item.rules,
      data.photos !== undefined ? data.photos : item.photos,
      id
    )
    .run();
  return true;
}

/** Delete preapproval item. */
export async function deletePreapprovalItem(db: D1Database, id: string): Promise<boolean> {
  const r = await db.prepare('DELETE FROM preapproval_items WHERE id = ?').bind(id).run();
  return r.meta.changes > 0;
}
