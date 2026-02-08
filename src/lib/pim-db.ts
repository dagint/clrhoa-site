/**
 * D1 audit log for PIM elevation (who requested elevated access, when, expiry).
 */

export interface PimElevationLogRow {
  id: number;
  email: string;
  role: string;
  action: string;
  elevated_at: string;
  expires_at: string | null;
}

/** List recent PIM elevation/drop events for audit report. Newest first. */
export async function listPimElevationLog(
  db: D1Database,
  limit = 500,
  offset = 0
): Promise<PimElevationLogRow[]> {
  const safeOffset = Math.max(0, offset);
  const { results } = await db
    .prepare(
      `SELECT id, email, role, action, elevated_at, expires_at
       FROM pim_elevation_log
       ORDER BY elevated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, safeOffset)
    .all();
  return (results ?? []) as PimElevationLogRow[];
}

export async function insertPimElevationLog(
  db: D1Database,
  params: { email: string; role: string; action: 'elevate' | 'drop'; expires_at?: string | null }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO pim_elevation_log (email, role, action, expires_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(
      params.email.trim().toLowerCase(),
      params.role?.trim() ?? 'member',
      params.action,
      params.expires_at ?? null
    )
    .run();
}
