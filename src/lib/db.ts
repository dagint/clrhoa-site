/**
 * D1 database helpers for CLR HOA portal.
 * Schema: users (email PRIMARY KEY, role, name, created)
 */

export interface PortalUser {
  email: string;
  role: string;
  name: string | null;
  created: string;
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
      'SELECT email, role, name, created FROM users WHERE email = ? LIMIT 1'
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
