/**
 * Dashboard notification dismissals: "Mark as read" for Action needed and staff outstanding items.
 * Keys: action_feedback, action_maintenance, action_meetings, staff_outstanding.
 * Dismissals are respected for DISMISSAL_DAYS; after that the notice can show again.
 */

export const DISMISSAL_DAYS = 7;

const VALID_KEYS = new Set(['action_feedback', 'action_maintenance', 'action_meetings', 'staff_outstanding']);

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
