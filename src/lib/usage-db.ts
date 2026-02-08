/**
 * D1 helpers for usage metrics: page views by path, session_id (anon), user_id when logged in.
 * Public: daily/weekly totals and unique sessions. Admin: user_id → pages → timestamps.
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

export interface PageViewRow {
  id: string;
  created_at: string;
  path: string;
  session_id: string;
  user_id: string | null;
}

export async function insertPageView(
  db: D1Database,
  data: { path: string; session_id: string; user_id?: string | null }
): Promise<string> {
  const id = generateId();
  const path = (data.path ?? '').trim().slice(0, 2048) || '/';
  const sessionId = (data.session_id ?? '').trim().slice(0, 64) || '';
  const userId = data.user_id?.trim().slice(0, 256) ?? null;

  if (!sessionId) throw new Error('session_id required');

  await db
    .prepare(
      `INSERT INTO page_views (id, path, session_id, user_id)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, path, sessionId, userId)
    .run();

  return id;
}

export interface DailyStat {
  date: string;
  views: number;
  uniqueSessions: number;
  /** Distinct logged-in users (user_id not null) per day. */
  uniqueUsers: number;
}

export interface WeeklyStat {
  weekStart: string;
  views: number;
  uniqueSessions: number;
  /** Distinct logged-in users per week. */
  uniqueUsers: number;
}

/** Last N days: views, unique sessions, and unique logged-in users per day. Date format YYYY-MM-DD. */
export async function getDailyStats(db: D1Database, days = 30): Promise<DailyStat[]> {
  const { results } = await db
    .prepare(
      `SELECT date(created_at) as date,
              COUNT(*) as views,
              COUNT(DISTINCT session_id) as uniqueSessions,
              COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id END) as uniqueUsers
       FROM page_views
       WHERE created_at >= date('now', ?)
       GROUP BY date(created_at)
       ORDER BY date ASC`
    )
    .bind(`-${days} days`)
    .all<DailyStat>();

  return results ?? [];
}

/** Last N weeks: views, unique sessions, and unique logged-in users per week (week start = Sunday). */
export async function getWeeklyStats(db: D1Database, weeks = 12): Promise<WeeklyStat[]> {
  const { results } = await db
    .prepare(
      `SELECT date(created_at, 'weekday 0', '-6 days') as weekStart,
              COUNT(*) as views,
              COUNT(DISTINCT session_id) as uniqueSessions,
              COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id END) as uniqueUsers
       FROM page_views
       WHERE created_at >= date('now', ?)
       GROUP BY weekStart
       ORDER BY weekStart ASC`
    )
    .bind(`-${weeks * 7} days`)
    .all<WeeklyStat>();

  return results ?? [];
}

export interface AdminPageViewRow {
  user_id: string | null;
  path: string;
  created_at: string;
}

export interface AdminPageViewFilters {
  /** Filter by user_id (partial match; empty = all). */
  user?: string | null;
  /** Limit to last N days (7, 30, 90); null/0 = all time. */
  periodDays?: number | null;
}

/** Admin: recent page views with optional filters. Paginated. */
export async function getAdminPageViews(
  db: D1Database,
  limit = 500,
  offset = 0,
  filters?: AdminPageViewFilters
): Promise<AdminPageViewRow[]> {
  const cap = Math.min(Math.max(limit, 1), 5000);
  const safeOffset = Math.max(0, offset);
  const userTrim = filters?.user?.trim();
  const periodDays = filters?.periodDays ?? 0;
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (userTrim) {
    conditions.push('user_id LIKE ?');
    bindings.push('%' + userTrim + '%');
  }
  if (periodDays > 0) {
    conditions.push("created_at >= date('now', ?)");
    bindings.push('-' + periodDays + ' days');
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT user_id, path, created_at
       FROM page_views${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`;
  const { results } = await db
    .prepare(sql)
    .bind(...bindings, cap, safeOffset)
    .all<AdminPageViewRow>();

  return results ?? [];
}

/** Count page views matching the same filters (for pagination). */
export async function getAdminPageViewsCount(
  db: D1Database,
  filters?: AdminPageViewFilters
): Promise<number> {
  const userTrim = filters?.user?.trim();
  const periodDays = filters?.periodDays ?? 0;
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (userTrim) {
    conditions.push('user_id LIKE ?');
    bindings.push('%' + userTrim + '%');
  }
  if (periodDays > 0) {
    conditions.push("created_at >= date('now', ?)");
    bindings.push('-' + periodDays + ' days');
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const row = await db
    .prepare(`SELECT COUNT(*) as cnt FROM page_views${where}`)
    .bind(...bindings)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export interface TopPageStat {
  path: string;
  views: number;
  uniqueSessions: number;
}

/** Top N paths by total views (last 90 days). For admin usage chart. */
export async function getTopPagesByViews(
  db: D1Database,
  limit = 10
): Promise<TopPageStat[]> {
  const cap = Math.min(Math.max(limit, 1), 50);
  const { results } = await db
    .prepare(
      `SELECT path,
              COUNT(*) as views,
              COUNT(DISTINCT session_id) as uniqueSessions
       FROM page_views
       WHERE created_at >= date('now', '-90 days')
       GROUP BY path
       ORDER BY views DESC
       LIMIT ?`
    )
    .bind(cap)
    .all<{ path: string; views: number; uniqueSessions: number }>();

  return (results ?? []) as TopPageStat[];
}

/**
 * Delete page_views older than the given number of days. Use for retention (e.g. with PAGE_VIEWS_RETENTION_DAYS).
 * Returns the number of rows deleted.
 */
export async function deletePageViewsOlderThan(
  db: D1Database,
  days: number
): Promise<number> {
  if (days < 1) return 0;
  const result = await db
    .prepare("DELETE FROM page_views WHERE created_at < date('now', ?)")
    .bind('-' + days + ' days')
    .run();
  return result.meta.changes ?? 0;
}
