/**
 * D1 helpers for maintenance requests (Phase 4).
 */

export interface MaintenanceRequest {
  id: string;
  owner_email: string;
  category: string;
  description: string;
  status: string;
  vendor_assigned: string | null;
  photos: string | null;
  created: string;
  updated: string;
}

const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateId(len: number = 12): string {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  let id = '';
  for (let i = 0; i < len; i++) id += ID_CHARS[bytes[i]! % ID_CHARS.length];
  return id;
}

export function createMaintenanceId(): string {
  return `maint_${generateId(14)}`;
}

export const MAINTENANCE_CATEGORIES = ['general', 'plumbing', 'electrical', 'landscaping', 'paving', 'lighting', 'other'] as const;

/** List by owner email. */
export async function listMaintenanceByOwner(db: D1Database, ownerEmail: string): Promise<MaintenanceRequest[]> {
  const result = await db
    .prepare(
      `SELECT id, owner_email, category, description, status, vendor_assigned, photos, created, updated
       FROM maintenance_requests WHERE owner_email = ? ORDER BY created DESC`
    )
    .bind(ownerEmail.trim().toLowerCase())
    .all<MaintenanceRequest>();
  return result.results ?? [];
}

/** List all for board, optional status filter. */
export async function listAllMaintenance(
  db: D1Database,
  statusFilter?: 'reported' | 'in_progress' | 'completed'
): Promise<MaintenanceRequest[]> {
  if (statusFilter) {
    const result = await db
      .prepare(
        `SELECT id, owner_email, category, description, status, vendor_assigned, photos, created, updated
         FROM maintenance_requests WHERE status = ? ORDER BY updated DESC, created DESC`
      )
      .bind(statusFilter)
      .all<MaintenanceRequest>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(
      `SELECT id, owner_email, category, description, status, vendor_assigned, photos, created, updated
       FROM maintenance_requests ORDER BY updated DESC, created DESC`
    )
    .all<MaintenanceRequest>();
  return result.results ?? [];
}

/** Get one by id. */
export async function getMaintenanceById(db: D1Database, id: string): Promise<MaintenanceRequest | null> {
  return db
    .prepare(
      `SELECT id, owner_email, category, description, status, vendor_assigned, photos, created, updated
       FROM maintenance_requests WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first<MaintenanceRequest>();
}

/** Insert new request. */
export async function insertMaintenanceRequest(
  db: D1Database,
  id: string,
  ownerEmail: string,
  category: string,
  description: string,
  photosJson: string | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO maintenance_requests (id, owner_email, category, description, status, photos, created, updated)
       VALUES (?, ?, ?, ?, 'reported', ?, datetime('now'), datetime('now'))`
    )
    .bind(id, ownerEmail.trim().toLowerCase(), category, description.trim(), photosJson)
    .run();
}

/** Update status and/or vendor (board). */
export async function updateMaintenanceRequest(
  db: D1Database,
  id: string,
  data: { status?: string; vendor_assigned?: string | null }
): Promise<boolean> {
  const req = await getMaintenanceById(db, id);
  if (!req) return false;
  const status = data.status ?? req.status;
  const vendor = data.vendor_assigned !== undefined ? data.vendor_assigned : req.vendor_assigned;
  await db
    .prepare(
      `UPDATE maintenance_requests SET status = ?, vendor_assigned = ?, updated = datetime('now') WHERE id = ?`
    )
    .bind(status, vendor, id)
    .run();
  return true;
}

/** Parse photos JSON to array of R2 keys. */
export function parsePhotosJson(photos: string | null): string[] {
  if (!photos) return [];
  try {
    const arr = JSON.parse(photos);
    if (!Array.isArray(arr)) return [];
    return arr.filter((k): k is string => typeof k === 'string' && k.length > 0);
  } catch {
    return [];
  }
}
