/**
 * D1 helpers for site feedback widget (thumbs + 140-char comment).
 * No PII: url, time, viewport, session_id only.
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

export interface SiteFeedbackRow {
  id: string;
  url: string;
  created_at: string;
  viewport: string | null;
  session_id: string | null;
  thumbs: number;
  comment: string | null;
}

export async function insertSiteFeedback(
  db: D1Database,
  data: {
    url: string;
    viewport?: string | null;
    session_id?: string | null;
    thumbs: number;
  comment?: string | null;
  }
): Promise<string> {
  const id = generateId();
  const url = (data.url ?? '').slice(0, 2048);
  const viewport = data.viewport?.slice(0, 64) ?? null;
  const sessionId = data.session_id?.slice(0, 64) ?? null;
  const thumbs = data.thumbs === 1 ? 1 : data.thumbs === -1 ? -1 : 0;
  const comment = data.comment?.trim().slice(0, 140) ?? null;

  await db
    .prepare(
      `INSERT INTO site_feedback (id, url, viewport, session_id, thumbs, comment)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, url, viewport, sessionId, thumbs, comment)
    .run();

  return id;
}

export interface ListSiteFeedbackFilters {
  thumbs?: 1 | -1 | null;
  from?: string | null;
  to?: string | null;
  urlContains?: string | null;
  limit?: number;
}

export async function listSiteFeedback(
  db: D1Database,
  filters: ListSiteFeedbackFilters = {}
): Promise<SiteFeedbackRow[]> {
  const conditions: string[] = [];
  const bind: (string | number)[] = [];
  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 5000);

  if (filters.thumbs === 1 || filters.thumbs === -1) {
    conditions.push('thumbs = ?');
    bind.push(filters.thumbs);
  }
  if (filters.from?.trim()) {
    conditions.push("created_at >= ?");
    bind.push(filters.from.trim());
  }
  if (filters.to?.trim()) {
    conditions.push("created_at <= ?");
    bind.push(filters.to.trim());
  }
  if (filters.urlContains?.trim()) {
    conditions.push('url LIKE ?');
    bind.push('%' + filters.urlContains.trim() + '%');
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const { results } = await db
    .prepare(
      `SELECT id, url, created_at, viewport, session_id, thumbs, comment
       FROM site_feedback ${where} ORDER BY created_at DESC LIMIT ?`
    )
    .bind(...bind, limit)
    .all<SiteFeedbackRow>();

  return results ?? [];
}
