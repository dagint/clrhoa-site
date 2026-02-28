/**
 * Dashboard notification dismissals: "Mark as read" for Action needed and staff outstanding items.
 * Keys: action_feedback, action_maintenance, action_meetings, staff_outstanding, pref_update_prompt.
 * Dismissals are respected for DISMISSAL_DAYS; after that the notice can show again.
 * Exception: pref_update_prompt uses hasPermanentlyDismissed (no TTL, never re-shows).
 */

export const DISMISSAL_DAYS = 7;

const VALID_KEYS = new Set(['action_feedback', 'action_maintenance', 'action_meetings', 'staff_outstanding', 'pref_update_prompt']);

export function isValidDismissalKey(key: string): boolean {
  return typeof key === 'string' && VALID_KEYS.has(key.trim());
}

/** Get set of notification_key that this user has dismissed within the last DISMISSAL_DAYS days. */
export async function getDismissedKeys(
  db: D1Database,
  email: string,
  withinDays: number = DISMISSAL_DAYS
): Promise<Set<string>> {
  if (!db || !email?.trim()) return new Set();
  const since = new Date();
  since.setDate(since.getDate() - withinDays);
  const sinceStr = since.toISOString().slice(0, 19).replace('T', ' ');
  const { results } = await db
    .prepare(
      `SELECT notification_key FROM notification_dismissals
       WHERE email = ? AND dismissed_at >= ?`
    )
    .bind(email.trim().toLowerCase(), sinceStr)
    .all<{ notification_key: string }>();
  return new Set((results ?? []).map((r) => r.notification_key));
}

/** Check if a user has ever dismissed a key (no TTL — permanent check). For one-time prompts. */
export async function hasPermanentlyDismissed(db: D1Database, email: string, key: string): Promise<boolean> {
  if (!db || !email?.trim()) return false;
  const row = await db
    .prepare(
      `SELECT 1 FROM notification_dismissals WHERE email = ? AND notification_key = ? LIMIT 1`
    )
    .bind(email.trim().toLowerCase(), key.trim())
    .first();
  return !!row;
}

/** Record a dismissal for the user. Replaces any existing row for (email, key). */
export async function setDismissed(db: D1Database, email: string, key: string): Promise<void> {
  if (!db || !email?.trim() || !isValidDismissalKey(key)) return;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await db
    .prepare(
      `INSERT INTO notification_dismissals (email, notification_key, dismissed_at)
       VALUES (?, ?, ?)
       ON CONFLICT (email, notification_key) DO UPDATE SET dismissed_at = excluded.dismissed_at`
    )
    .bind(email.trim().toLowerCase(), key.trim(), now)
    .run();
}
