/**
 * D1 helpers for board-added news items.
 * is_public = 1: show on public news page; show_on_portal = 1: show in member portal News.
 * images: JSON array of R2 keys (e.g. news/ID/filename.jpg).
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

export interface NewsItemRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_public: number;
  /** 1 = show in member portal News; 0 = do not show. Default 1. */
  show_on_portal: number;
  /** JSON array of R2 keys for attached images. */
  images: string | null;
}

function parseImagesJson(s: string | null): string[] {
  if (!s || !s.trim()) return [];
  try {
    const arr = JSON.parse(s) as unknown;
    return Array.isArray(arr) ? arr.filter((k): k is string => typeof k === 'string' && k.length > 0) : [];
  } catch {
    return [];
  }
}

const SELECT_COLS = 'id, title, body, created_at, is_public, COALESCE(show_on_portal, 1) as show_on_portal, images';

export async function listPublicNewsItems(db: D1Database, limit = 50): Promise<NewsItemRow[]> {
  const cap = Math.min(Math.max(limit, 1), 200);
  try {
    const { results } = await db
      .prepare(
        `SELECT ${SELECT_COLS} FROM news_items WHERE is_public = 1 ORDER BY created_at DESC LIMIT ?`
      )
      .bind(cap)
      .all<NewsItemRow>();
    return (results ?? []).map((r) => ({ ...r, images: r.images ?? null }));
  } catch {
    const { results } = await db
      .prepare(
        `SELECT id, title, body, created_at, is_public FROM news_items WHERE is_public = 1 ORDER BY created_at DESC LIMIT ?`
      )
      .bind(cap)
      .all<NewsItemRow & { show_on_portal?: number; images?: string | null }>();
    return (results ?? []).map((r) => ({ ...r, show_on_portal: 1, images: null }));
  }
}

/** Items to show in member portal News (show_on_portal = 1). */
export async function listPortalNewsItems(db: D1Database, limit = 100, offset = 0): Promise<NewsItemRow[]> {
  const cap = Math.min(Math.max(limit, 1), 500);
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(
        `SELECT ${SELECT_COLS} FROM news_items WHERE COALESCE(show_on_portal, 1) = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(cap, safeOffset)
      .all<NewsItemRow>();
    return (results ?? []).map((r) => ({ ...r, images: r.images ?? null }));
  } catch {
    return listAllNewsItems(db, cap, safeOffset);
  }
}

export async function listAllNewsItems(db: D1Database, limit = 100, offset = 0): Promise<NewsItemRow[]> {
  const cap = Math.min(Math.max(limit, 1), 500);
  const safeOffset = Math.max(0, offset);
  try {
    const { results } = await db
      .prepare(
        `SELECT ${SELECT_COLS} FROM news_items ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(cap, safeOffset)
      .all<NewsItemRow>();
    return (results ?? []).map((r) => ({ ...r, images: r.images ?? null }));
  } catch {
    const { results } = await db
      .prepare(
        `SELECT id, title, body, created_at, is_public FROM news_items ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(cap, safeOffset)
      .all<NewsItemRow & { show_on_portal?: number; images?: string | null }>();
    return (results ?? []).map((r) => ({ ...r, show_on_portal: 1, images: null }));
  }
}

export async function getNewsItemById(db: D1Database, id: string): Promise<NewsItemRow | null> {
  try {
    const row = await db
      .prepare(`SELECT ${SELECT_COLS} FROM news_items WHERE id = ?`)
      .bind(id)
      .first<NewsItemRow>();
    if (!row) return null;
    return { ...row, images: row.images ?? null };
  } catch {
    const row = await db
      .prepare(`SELECT id, title, body, created_at, is_public FROM news_items WHERE id = ?`)
      .bind(id)
      .first<NewsItemRow & { show_on_portal?: number; images?: string | null }>();
    if (!row) return null;
    return { ...row, show_on_portal: 1, images: null };
  }
}

/** Get image keys for a news item (parsed array). */
export function getNewsItemImageKeys(item: NewsItemRow): string[] {
  return parseImagesJson(item.images);
}

export async function insertNewsItem(
  db: D1Database,
  data: { title: string; body: string; is_public?: number; show_on_portal?: number; images?: string[] }
): Promise<string> {
  const id = generateId();
  const title = (data.title ?? '').trim().slice(0, 500);
  const body = (data.body ?? '').trim().slice(0, 50000);
  const isPublic = data.is_public === 1 ? 1 : 0;
  const showOnPortal = data.show_on_portal === 0 ? 0 : 1;
  const imagesJson = data.images?.length ? JSON.stringify(data.images) : null;
  if (!title) throw new Error('title required');

  try {
    await db
      .prepare(
        `INSERT INTO news_items (id, title, body, is_public, show_on_portal, images)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, title, body, isPublic, showOnPortal, imagesJson)
      .run();
  } catch {
    await db
      .prepare(
        `INSERT INTO news_items (id, title, body, is_public)
         VALUES (?, ?, ?, ?)`
      )
      .bind(id, title, body, isPublic)
      .run();
  }
  return id;
}

/** Append R2 keys to a news item's images. Returns new keys array. */
export async function appendNewsItemImages(
  db: D1Database,
  id: string,
  newKeys: string[]
): Promise<string[]> {
  if (newKeys.length === 0) return getNewsItemImageKeys((await getNewsItemById(db, id))!);
  const item = await getNewsItemById(db, id);
  if (!item) throw new Error('News item not found');
  const existing = parseImagesJson(item.images);
  const combined = [...existing, ...newKeys];
  const imagesJson = JSON.stringify(combined);
  try {
    await db.prepare(`UPDATE news_items SET images = ? WHERE id = ?`).bind(imagesJson, id).run();
  } catch {
    // Column may not exist
  }
  return combined;
}
