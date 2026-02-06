/**
 * Data retention and deletion utilities.
 * Implements retention policies for ARB requests and audit logs.
 */

export interface RetentionPolicy {
  status: string;
  retentionDays: number;
}

/**
 * Retention policies for different request statuses.
 */
export const RETENTION_POLICIES: RetentionPolicy[] = [
  { status: 'approved', retentionDays: 7 * 365 }, // 7 years (legal/audit)
  { status: 'rejected', retentionDays: 7 * 365 }, // 7 years (legal/audit)
  { status: 'cancelled', retentionDays: 365 }, // 1 year
  { status: 'pending', retentionDays: 365 }, // 1 year (should be submitted or cancelled)
  { status: 'in_review', retentionDays: 365 }, // 1 year (should be decided)
];

/**
 * Retention policy for audit logs.
 */
export const AUDIT_LOG_RETENTION_DAYS = 7 * 365; // 7 years

/**
 * Soft delete a request (marks as deleted but keeps data).
 */
export async function softDeleteRequest(
  db: D1Database,
  requestId: string
): Promise<boolean> {
  try {
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
 */
export async function permanentlyDeleteOldRecords(
  db: D1Database,
  gracePeriodDays: number = 30
): Promise<{ requests: number; auditLogs: number; errors: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);
  const cutoff = cutoffDate.toISOString();

  let requestsDeleted = 0;
  let auditLogsDeleted = 0;
  let errors = 0;

  try {
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

  return { requests: requestsDeleted, auditLogs: auditLogsDeleted, errors };
}
