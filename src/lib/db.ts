/**
 * D1 database helpers for CLR HOA portal.
 * Schema: users (email PRIMARY KEY, role, name, created)
 */

/** Per-type notification opt-in/out. Key = type (e.g. feedback_new_doc), value = true to receive. Missing key = send (default). */
export type NotificationPreferences = Record<string, boolean>;

export interface PortalUser {
  email: string;
  role: string;
  name: string | null;
  created: string;
  phone?: string | null;
  sms_optin?: number | boolean | null; // D1: 0/1
  notification_preferences?: string | null; // JSON: NotificationPreferences
}

export interface EnvWithDb {
  DB: D1Database;
  CLOURHOA_USERS?: KVNamespace;
  CLOURHOA_FILES?: R2Bucket;
  SESSION_SECRET?: string;
}

/**
 * Get user by email from D1. Returns null if not found.
 */
export async function getUserByEmail(
  db: D1Database,
  email: string
): Promise<PortalUser | null> {
  const normalized = email.trim().toLowerCase();
  const row = await db
    .prepare(
      'SELECT email, role, name, created, phone, sms_optin, notification_preferences FROM users WHERE email = ? LIMIT 1'
    )
    .bind(normalized)
    .first<PortalUser>();
  return row;
}

/**
 * Insert or replace user (used when whitelisted user first logs in).
 * Default role is 'member'.
 */
export async function upsertUser(
  db: D1Database,
  email: string,
  name: string | null = null,
  role: string = 'member'
): Promise<PortalUser> {
  const normalized = email.trim().toLowerCase();
  await db
    .prepare(
      `INSERT INTO users (email, role, name, created)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(email) DO UPDATE SET
         name = COALESCE(excluded.name, name),
         role = COALESCE(users.role, excluded.role)`
    )
    .bind(normalized, role, name ?? null)
    .run();

  const user = await getUserByEmail(db, normalized);
  if (!user) throw new Error('Failed to upsert user');
  return user;
}

/**
 * Update user notification preferences (phone, SMS opt-in, per-type email prefs). Phase 3.5.
 */
export async function updateUserPreferences(
  db: D1Database,
  email: string,
  preferences: {
    phone?: string | null;
    sms_optin?: boolean;
    notification_preferences?: NotificationPreferences | null;
  }
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const phone = preferences.phone !== undefined ? (preferences.phone?.trim() || null) : undefined;
  const smsOptin = preferences.sms_optin !== undefined ? (preferences.sms_optin ? 1 : 0) : undefined;
  const notifPrefs =
    preferences.notification_preferences !== undefined
      ? (Object.keys(preferences.notification_preferences || {}).length > 0
          ? JSON.stringify(preferences.notification_preferences)
          : null)
      : undefined;

  const updates: string[] = [];
  const bindings: (string | number | null)[] = [];
  if (phone !== undefined) {
    updates.push('phone = ?');
    bindings.push(phone);
  }
  if (smsOptin !== undefined) {
    updates.push('sms_optin = ?');
    bindings.push(smsOptin);
  }
  if (notifPrefs !== undefined) {
    updates.push('notification_preferences = ?');
    bindings.push(notifPrefs);
  }
  if (updates.length > 0) {
    bindings.push(normalized);
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE email = ?`).bind(...bindings).run();
  }
}

/**
 * Get email and notification_preferences for a list of emails (for filtering who receives a notification type).
 */
export async function getNotificationPrefsForEmails(
  db: D1Database,
  emails: string[]
): Promise<{ email: string; notification_preferences: string | null }[]> {
  if (emails.length === 0) return [];
  const normalized = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const placeholders = normalized.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT email, notification_preferences FROM users WHERE email IN (${placeholders})`
    )
    .bind(...normalized)
    .all<{ email: string; notification_preferences: string | null }>();
  return results ?? [];
}
