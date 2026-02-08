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
}

export interface WeeklyStat {
  weekStart: string;
  views: number;
  uniqueSessions: number;
}

/** Last N days: views and unique sessions per day. Date format YYYY-MM-DD. */
export async function getDailyStats(db: D1Database, days = 30): Promise<DailyStat[]> {
  const { results } = await db
    .prepare(
      `SELECT date(created_at) as date,
              COUNT(*) as views,
              COUNT(DISTINCT session_id) as uniqueSessions
       FROM page_views
       WHERE created_at >= date('now', ?)
       GROUP BY date(created_at)
       ORDER BY date ASC`
    )
    .bind(`-${days} days`)
    .all<DailyStat>();

  return results ?? [];
}

/** Last N weeks: views and unique sessions per week (week start = Sunday). */
export async function getWeeklyStats(db: D1Database, weeks = 12): Promise<WeeklyStat[]> {
  const { results } = await db
    .prepare(
      `SELECT date(created_at, 'weekday 0', '-6 days') as weekStart,
              COUNT(*) as views,
              COUNT(DISTINCT session_id) as uniqueSessions
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

/** Admin: recent page views with user_id (or null for anon), path, timestamp. */
export async function getAdminPageViews(
  db: D1Database,
  limit = 500
): Promise<AdminPageViewRow[]> {
  const cap = Math.min(Math.max(limit, 1), 5000);
  const { results } = await db
    .prepare(
      `SELECT user_id, path, created_at
       FROM page_views
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(cap)
    .all<AdminPageViewRow>();

  return results ?? [];
}
