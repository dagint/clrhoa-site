/**
 * D1 helpers for login history (last logon timestamp, profile history).
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

export interface LoginHistoryRow {
  id: string;
  email: string;
  logged_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

/** Record a successful login. Call after session is created. */
export async function insertLoginHistory(
  db: D1Database,
  email: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> {
  const id = generateId();
  const normalized = email.trim().toLowerCase();
  const ip = ipAddress?.trim() || null;
  const ua = userAgent?.trim() || null;
  await db
    .prepare(
      `INSERT INTO login_history (id, email, logged_at, ip_address, user_agent) VALUES (?, ?, datetime('now'), ?, ?)`
    )
    .bind(id, normalized, ip, ua)
    .run();
}

/** List recent logins for an email (newest first). Used for profile "Login activity". */
export async function listLoginHistoryByEmail(
  db: D1Database,
  email: string,
  limit: number = 50
): Promise<LoginHistoryRow[]> {
  const normalized = email.trim().toLowerCase();
  const { results } = await db
    .prepare(
      `SELECT id, email, logged_at, ip_address, user_agent FROM login_history WHERE email = ? ORDER BY logged_at DESC LIMIT ?`
    )
    .bind(normalized, Math.max(1, Math.min(limit, 200)))
    .all<LoginHistoryRow>();
  return results ?? [];
}
