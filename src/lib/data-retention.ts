/**
 * Data retention and deletion utilities.
 * Implements retention policies for ARB requests, audit logs, and maintenance requests.
 *
 * Florida (FL) context: Fla. Stat. 720.303 requires official records (e.g. meeting minutes,
 * insurance) to be retained for 7 years; work bids 1 year. Maintenance work orders / repair
 * requests are not explicitly listed, so we use 1 year for completed maintenance to reduce
 * storage while staying within a conservative, FL-aligned period.
 */

export interface RetentionPolicy {
  status: string;
  retentionDays: number;
}

/**
 * Retention policies for different request statuses.
 */
export const RETENTION_POLICIES: RetentionPolicy[] = [
  { status: 'approved', retentionDays: 7 * 365 }, // 7 years (FL official records / audit)
  { status: 'rejected', retentionDays: 7 * 365 }, // 7 years (FL official records / audit)
  { status: 'cancelled', retentionDays: 365 }, // 1 year
  { status: 'pending', retentionDays: 365 }, // 1 year (should be submitted or cancelled)
  { status: 'in_review', retentionDays: 365 }, // 1 year (should be decided)
];

/**
 * Retention policy for audit logs.
 */
export const AUDIT_LOG_RETENTION_DAYS = 7 * 365; // 7 years

/**
 * After this many days, completed maintenance **photos** are removed from R2 and the photos
 * column is cleared. Metadata (row) is kept to avoid storage cost from images while preserving
 * history (category, description, status, vendor_assigned, dates).
 */
export const MAINTENANCE_PHOTOS_RETENTION_DAYS = 365; // 1 year

/**
 * After this many days, completed maintenance **rows** are permanently deleted (optional).
 * Use a long period or run rarely; metadata is small. Set to 0 to never delete rows (only purge photos).
 */
export const MAINTENANCE_METADATA_RETENTION_DAYS = 7 * 365; // 7 years (0 = never delete rows)

/** @deprecated Use MAINTENANCE_PHOTOS_RETENTION_DAYS for photo purge; MAINTENANCE_METADATA_RETENTION_DAYS for row delete. */
export const MAINTENANCE_COMPLETED_RETENTION_DAYS = MAINTENANCE_PHOTOS_RETENTION_DAYS;

/**
 * Recommended retention for granular page_views (usage analytics).
 * Raw rows can be deleted after this period; daily/weekly aggregates (if stored) may be kept longer.
 * Set to 0 to keep page views indefinitely. Use with usage-db.deletePageViewsOlderThan() in a scheduled job.
 */
export const PAGE_VIEWS_RETENTION_DAYS = 90;

/** R2 bucket–like interface for deleting object keys (avoids hard dependency on Cloudflare types). */
export interface R2BucketLike {
  delete(key: string): Promise<void>;
}

/**
 * Soft delete a request (marks as deleted but keeps data).
 * When r2 is provided, also deletes associated R2 files immediately.
 */
export async function softDeleteRequest(
  db: D1Database,
  requestId: string,
  r2?: R2BucketLike
): Promise<boolean> {
  try {
    // Delete R2 files first if r2 bucket provided
    if (r2) {
      try {
        const { results: files } = await db
          .prepare('SELECT r2_keys FROM arb_files WHERE request_id = ?')
          .bind(requestId)
          .all<{ r2_keys: string }>();

        for (const file of files ?? []) {
          const keys = parseR2Keys(file.r2_keys);
          for (const key of keys) {
            try {
              await r2.delete(key);
            } catch (e) {
              console.warn('[data-retention] R2 delete failed for ARB file:', key, e);
            }
          }
        }
      } catch (e) {
        console.error('[data-retention] Failed to delete R2 files for request:', requestId, e);
      }
    }

    const result = await db
      .prepare('UPDATE arb_requests SET deleted_at = datetime("now") WHERE id = ?')
      .bind(requestId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  } catch (e) {
    console.error('[data-retention] Failed to soft delete request:', e);
    return false;
  }
}

/**
 * Soft delete audit log entries older than retention period.
 */
export async function softDeleteOldAuditLogs(
  db: D1Database,
  retentionDays: number = AUDIT_LOG_RETENTION_DAYS
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoff = cutoffDate.toISOString();

    const result = await db
      .prepare('UPDATE arb_audit_log SET deleted_at = datetime("now") WHERE created < ? AND (deleted_at IS NULL OR deleted_at = "")')
      .bind(cutoff)
      .run();
    return result.meta.changes ?? 0;
  } catch (e) {
    console.error('[data-retention] Failed to soft delete old audit logs:', e);
    return 0;
  }
}

/**
 * Apply retention policies to requests.
 * Soft deletes requests that exceed their retention period.
 */
export async function applyRetentionPolicies(db: D1Database): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  for (const policy of RETENTION_POLICIES) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
      const cutoff = cutoffDate.toISOString();

      // For approved/rejected, use esign_timestamp if available, otherwise created
      const dateField = policy.status === 'approved' || policy.status === 'rejected'
        ? "COALESCE(esign_timestamp, created)"
        : "created";

      const result = await db
        .prepare(
          `UPDATE arb_requests SET deleted_at = datetime("now") WHERE status = ? AND ${dateField} < ? AND (deleted_at IS NULL OR deleted_at = "")`
        )
        .bind(policy.status, cutoff)
        .run();

      deleted += result.meta.changes ?? 0;
    } catch (e) {
      console.error(`[data-retention] Failed to apply retention policy for ${policy.status}:`, e);
      errors++;
    }
  }

  return { deleted, errors };
}

/**
 * Permanently delete soft-deleted records older than grace period (30 days).
 * This is a destructive operation - use with caution!
 * When r2 is provided, also deletes associated R2 files for ARB requests.
 */
export async function permanentlyDeleteOldRecords(
  db: D1Database,
  options: {
    gracePeriodDays?: number;
    /** When provided, R2 files for ARB requests are deleted before removing DB rows. */
    r2?: R2BucketLike;
  } = {}
): Promise<{ requests: number; auditLogs: number; r2Errors: number; errors: number }> {
  const gracePeriodDays = options.gracePeriodDays ?? 30;
  const r2 = options.r2;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);
  const cutoff = cutoffDate.toISOString();

  let requestsDeleted = 0;
  let auditLogsDeleted = 0;
  let r2Errors = 0;
  let errors = 0;

  try {
    // If R2 provided, delete files for old soft-deleted requests first
    if (r2) {
      const { results: requests } = await db
        .prepare('SELECT id FROM arb_requests WHERE deleted_at < ? AND deleted_at IS NOT NULL AND deleted_at != ""')
        .bind(cutoff)
        .all<{ id: string }>();

      for (const req of requests ?? []) {
        try {
          const { results: files } = await db
            .prepare('SELECT r2_keys FROM arb_files WHERE request_id = ?')
            .bind(req.id)
            .all<{ r2_keys: string }>();

          for (const file of files ?? []) {
            const keys = parseR2Keys(file.r2_keys);
            for (const key of keys) {
              try {
                await r2.delete(key);
              } catch (e) {
                console.warn('[data-retention] R2 delete failed for ARB file:', key, e);
                r2Errors++;
              }
            }
          }
        } catch (e) {
          console.error('[data-retention] Failed to delete R2 files for request:', req.id, e);
          r2Errors++;
        }
      }
    }

    // Delete old soft-deleted requests
    const requestsResult = await db
      .prepare('DELETE FROM arb_requests WHERE deleted_at < ? AND deleted_at IS NOT NULL AND deleted_at != ""')
      .bind(cutoff)
      .run();
    requestsDeleted = requestsResult.meta.changes ?? 0;
  } catch (e) {
    console.error('[data-retention] Failed to permanently delete old requests:', e);
    errors++;
  }

  try {
    // Delete old soft-deleted audit logs
    const auditResult = await db
      .prepare('DELETE FROM arb_audit_log WHERE deleted_at < ? AND deleted_at IS NOT NULL AND deleted_at != ""')
      .bind(cutoff)
      .run();
    auditLogsDeleted = auditResult.meta.changes ?? 0;
  } catch (e) {
    console.error('[data-retention] Failed to permanently delete old audit logs:', e);
    errors++;
  }

  return { requests: requestsDeleted, auditLogs: auditLogsDeleted, r2Errors, errors };
}

function parsePhotoKeys(photos: string | null): string[] {
  if (!photos) return [];
  try {
    const arr = JSON.parse(photos);
    if (!Array.isArray(arr)) return [];
    return arr.filter((k): k is string => typeof k === 'string' && k.length > 0);
  } catch {
    return [];
  }
}

/**
 * Parse R2 keys from arb_files.r2_keys JSON column.
 * Format: {"originals": ["key1"], "review": ["key2"], "archive": ["key3"]}
 */
function parseR2Keys(r2KeysJson: string | null): string[] {
  if (!r2KeysJson) return [];
  try {
    const obj = JSON.parse(r2KeysJson) as { originals?: string[]; review?: string[]; archive?: string[] };
    const keys: string[] = [];
    if (obj.originals) keys.push(...obj.originals);
    if (obj.review) keys.push(...obj.review);
    if (obj.archive) keys.push(...obj.archive);
    return keys.filter((k): k is string => typeof k === 'string' && k.length > 0);
  } catch {
    return [];
  }
}

/**
 * Remove photos from R2 and clear the photos column for completed maintenance older than
 * retention days. Keeps the row (metadata) so history remains without image storage cost.
 * Call this regularly (e.g. weekly); pass r2 so R2 objects are deleted.
 */
export async function purgeOldCompletedMaintenancePhotos(
  db: D1Database,
  r2: R2BucketLike,
  retentionDays: number = MAINTENANCE_PHOTOS_RETENTION_DAYS
): Promise<{ rowsUpdated: number; r2Errors: number; errors: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoff = cutoffDate.toISOString();

  let rowsUpdated = 0;
  let r2Errors = 0;
  let errors = 0;

  try {
    const { results: rows } = await db
      .prepare(
        `SELECT id, photos FROM maintenance_requests WHERE status = 'completed' AND updated < ? AND photos IS NOT NULL AND photos != '' AND photos != '[]'`
      )
      .bind(cutoff)
      .all<{ id: string; photos: string | null }>();

    for (const row of rows ?? []) {
      try {
        const keys = parsePhotoKeys(row.photos);
        for (const key of keys) {
          try {
            await r2.delete(key);
          } catch (e) {
            console.warn('[data-retention] R2 delete failed for maintenance photo:', key, e);
            r2Errors += 1;
          }
        }
        await db.prepare('UPDATE maintenance_requests SET photos = NULL WHERE id = ?').bind(row.id).run();
        rowsUpdated += 1;
      } catch (e) {
        console.error('[data-retention] Failed to purge photos for maintenance request:', row.id, e);
        errors += 1;
      }
    }
  } catch (e) {
    console.error('[data-retention] Failed to list completed maintenance for photo purge:', e);
    errors += 1;
  }

  return { rowsUpdated, r2Errors, errors };
}

/**
 * Permanently delete completed maintenance rows (and any remaining R2 photos) older than
 * retention days. Use a long period (e.g. 7 years) or set retentionDays to 0 to skip row
 * deletion. For cost control, run purgeOldCompletedMaintenancePhotos regularly instead;
 * this is for eventually removing very old metadata.
 */
export async function deleteOldCompletedMaintenance(
  db: D1Database,
  options: {
    retentionDays?: number;
    /** When provided, photo keys are deleted from R2 before removing DB rows. */
    r2?: R2BucketLike;
  } = {}
): Promise<{ deleted: number; r2Errors: number; errors: number }> {
  const retentionDays = options.retentionDays ?? MAINTENANCE_METADATA_RETENTION_DAYS;
  if (retentionDays <= 0) return { deleted: 0, r2Errors: 0, errors: 0 };

  const r2 = options.r2;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoff = cutoffDate.toISOString();

  let deleted = 0;
  let r2Errors = 0;
  let errors = 0;

  try {
    const { results: rows } = await db
      .prepare(
        `SELECT id, photos FROM maintenance_requests WHERE status = 'completed' AND updated < ?`
      )
      .bind(cutoff)
      .all<{ id: string; photos: string | null }>();

    const list = rows ?? [];
    for (const row of list) {
      try {
        const keys = parsePhotoKeys(row.photos);
        if (r2) {
          for (const key of keys) {
            try {
              await r2.delete(key);
            } catch (e) {
              console.warn('[data-retention] R2 delete failed for maintenance photo:', key, e);
              r2Errors += 1;
            }
          }
        }
        const result = await db.prepare('DELETE FROM maintenance_requests WHERE id = ?').bind(row.id).run();
        deleted += result.meta.changes ?? 0;
      } catch (e) {
        console.error('[data-retention] Failed to delete maintenance request:', row.id, e);
        errors += 1;
      }
    }
  } catch (e) {
    console.error('[data-retention] Failed to list/delete old completed maintenance:', e);
    errors += 1;
  }

  return { deleted, r2Errors, errors };
}
