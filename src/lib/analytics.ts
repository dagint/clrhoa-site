/**
 * Analytics & Usage Tracking
 *
 * Tracks signature creation, ARB submissions, and generates statistics
 * for board reporting and compliance monitoring.
 */

/// <reference types="@cloudflare/workers-types" />

/** Signature Analytics Event Types */
export type SignatureEventType = 'created' | 'verified' | 'viewed' | 'revoked';

/** ARB Analytics Event Types */
export type ArbEventType = 'submitted' | 'approved' | 'denied' | 'returned' | 'cancelled';

/** Track a signature-related event */
export async function trackSignatureEvent(
  db: D1Database,
  params: {
    eventType: SignatureEventType;
    signatureId: string;
    documentType: string;
    documentId: string;
    userEmail?: string;
    actorEmail?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO signature_analytics
       (event_type, signature_id, document_type, document_id, user_email, actor_email, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.eventType,
      params.signatureId,
      params.documentType,
      params.documentId,
      params.userEmail ?? null,
      params.actorEmail ?? null,
      params.ipAddress ?? null,
      params.userAgent ?? null
    )
    .run();

  // Update daily stats
  await incrementDailyStat(db, `signatures_${params.eventType}`);
}

/** Track an ARB request event */
export async function trackArbEvent(
  db: D1Database,
  params: {
    eventType: ArbEventType;
    requestId: string;
    ownerEmail: string;
    reviewerEmail?: string;
    hasSignature?: boolean;
    signatureId?: string;
    processingTimeHours?: number;
    revisionCount?: number;
    fileCount?: number;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO arb_analytics
       (event_type, request_id, owner_email, reviewer_email, has_signature, signature_id, processing_time_hours, revision_count, file_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.eventType,
      params.requestId,
      params.ownerEmail,
      params.reviewerEmail ?? null,
      params.hasSignature ? 1 : 0,
      params.signatureId ?? null,
      params.processingTimeHours ?? null,
      params.revisionCount ?? 0,
      params.fileCount ?? 0
    )
    .run();

  // Update daily stats
  await incrementDailyStat(db, `arb_${params.eventType}`);
  if (params.hasSignature) {
    await incrementDailyStat(db, 'arb_with_signature');
  }
}

/** Increment daily statistic counter */
async function incrementDailyStat(
  db: D1Database,
  metricType: string,
  count: number = 1
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  await db
    .prepare(
      `INSERT INTO daily_stats (date, metric_type, count)
       VALUES (?, ?, ?)
       ON CONFLICT(date, metric_type) DO UPDATE SET
         count = count + excluded.count`
    )
    .bind(today, metricType, count)
    .run();
}

/** Get signature statistics for a date range */
export async function getSignatureStats(
  db: D1Database,
  options?: {
    startDate?: string;  // YYYY-MM-DD
    endDate?: string;    // YYYY-MM-DD
    documentType?: string;
  }
): Promise<{
  totalCreated: number;
  totalVerified: number;
  totalViewed: number;
  totalRevoked: number;
  byDocumentType: Record<string, number>;
  byDay: Array<{ date: string; count: number }>;
}> {
  const startDate = options?.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = options?.endDate ?? new Date().toISOString().split('T')[0];

  // Get totals by event type
  const totalsQuery = options?.documentType
    ? `SELECT event_type, COUNT(*) as count FROM signature_analytics
       WHERE date(created_at) BETWEEN ? AND ? AND document_type = ?
       GROUP BY event_type`
    : `SELECT event_type, COUNT(*) as count FROM signature_analytics
       WHERE date(created_at) BETWEEN ? AND ?
       GROUP BY event_type`;

  const totals = await db
    .prepare(totalsQuery)
    .bind(startDate, endDate, ...(options?.documentType ? [options.documentType] : []))
    .all<{ event_type: string; count: number }>();

  const stats = {
    totalCreated: 0,
    totalVerified: 0,
    totalViewed: 0,
    totalRevoked: 0,
  };

  for (const row of totals.results ?? []) {
    switch (row.event_type) {
      case 'created':
        stats.totalCreated = row.count;
        break;
      case 'verified':
        stats.totalVerified = row.count;
        break;
      case 'viewed':
        stats.totalViewed = row.count;
        break;
      case 'revoked':
        stats.totalRevoked = row.count;
        break;
    }
  }

  // Get counts by document type
  const byTypeQuery = `SELECT document_type, COUNT(*) as count FROM signature_analytics
                       WHERE date(created_at) BETWEEN ? AND ? AND event_type = 'created'
                       GROUP BY document_type`;
  const byType = await db
    .prepare(byTypeQuery)
    .bind(startDate, endDate)
    .all<{ document_type: string; count: number }>();

  const byDocumentType: Record<string, number> = {};
  for (const row of byType.results ?? []) {
    byDocumentType[row.document_type] = row.count;
  }

  // Get daily counts
  const byDayQuery = `SELECT date(created_at) as date, COUNT(*) as count FROM signature_analytics
                      WHERE date(created_at) BETWEEN ? AND ? AND event_type = 'created'
                      GROUP BY date(created_at)
                      ORDER BY date(created_at)`;
  const byDay = await db
    .prepare(byDayQuery)
    .bind(startDate, endDate)
    .all<{ date: string; count: number }>();

  return {
    ...stats,
    byDocumentType,
    byDay: byDay.results ?? [],
  };
}

/** Get ARB request statistics for a date range */
export async function getArbStats(
  db: D1Database,
  options?: {
    startDate?: string;  // YYYY-MM-DD
    endDate?: string;    // YYYY-MM-DD
  }
): Promise<{
  totalSubmitted: number;
  totalApproved: number;
  totalDenied: number;
  totalReturned: number;
  totalCancelled: number;
  withSignature: number;
  withoutSignature: number;
  avgProcessingTimeHours: number;
  byDay: Array<{ date: string; submitted: number; approved: number; denied: number }>;
  topReviewers: Array<{ email: string; count: number }>;
}> {
  const startDate = options?.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = options?.endDate ?? new Date().toISOString().split('T')[0];

  // Get totals by event type
  const totals = await db
    .prepare(
      `SELECT event_type, COUNT(*) as count, AVG(processing_time_hours) as avg_time, SUM(has_signature) as sig_count
       FROM arb_analytics
       WHERE date(created_at) BETWEEN ? AND ?
       GROUP BY event_type`
    )
    .bind(startDate, endDate)
    .all<{ event_type: string; count: number; avg_time: number; sig_count: number }>();

  const stats = {
    totalSubmitted: 0,
    totalApproved: 0,
    totalDenied: 0,
    totalReturned: 0,
    totalCancelled: 0,
    withSignature: 0,
    withoutSignature: 0,
    avgProcessingTimeHours: 0,
  };

  let totalProcessingTime = 0;
  let processedCount = 0;

  for (const row of totals.results ?? []) {
    switch (row.event_type) {
      case 'submitted':
        stats.totalSubmitted = row.count;
        stats.withSignature = row.sig_count || 0;
        stats.withoutSignature = row.count - (row.sig_count || 0);
        break;
      case 'approved':
        stats.totalApproved = row.count;
        if (row.avg_time) {
          totalProcessingTime += row.avg_time * row.count;
          processedCount += row.count;
        }
        break;
      case 'denied':
        stats.totalDenied = row.count;
        if (row.avg_time) {
          totalProcessingTime += row.avg_time * row.count;
          processedCount += row.count;
        }
        break;
      case 'returned':
        stats.totalReturned = row.count;
        break;
      case 'cancelled':
        stats.totalCancelled = row.count;
        break;
    }
  }

  stats.avgProcessingTimeHours = processedCount > 0 ? totalProcessingTime / processedCount : 0;

  // Get daily submission/approval trends
  const byDay = await db
    .prepare(
      `SELECT
         date(created_at) as date,
         SUM(CASE WHEN event_type = 'submitted' THEN 1 ELSE 0 END) as submitted,
         SUM(CASE WHEN event_type = 'approved' THEN 1 ELSE 0 END) as approved,
         SUM(CASE WHEN event_type = 'denied' THEN 1 ELSE 0 END) as denied
       FROM arb_analytics
       WHERE date(created_at) BETWEEN ? AND ?
       GROUP BY date(created_at)
       ORDER BY date(created_at)`
    )
    .bind(startDate, endDate)
    .all<{ date: string; submitted: number; approved: number; denied: number }>();

  // Get top reviewers
  const topReviewers = await db
    .prepare(
      `SELECT reviewer_email as email, COUNT(*) as count
       FROM arb_analytics
       WHERE date(created_at) BETWEEN ? AND ?
         AND reviewer_email IS NOT NULL
         AND event_type IN ('approved', 'denied')
       GROUP BY reviewer_email
       ORDER BY count DESC
       LIMIT 10`
    )
    .bind(startDate, endDate)
    .all<{ email: string; count: number }>();

  return {
    ...stats,
    byDay: byDay.results ?? [],
    topReviewers: topReviewers.results ?? [],
  };
}

/** Get combined dashboard metrics */
export async function getDashboardMetrics(
  db: D1Database,
  period: 'today' | 'week' | 'month' | 'year' = 'month'
): Promise<{
  signatures: Awaited<ReturnType<typeof getSignatureStats>>;
  arb: Awaited<ReturnType<typeof getArbStats>>;
  period: { startDate: string; endDate: string; label: string };
}> {
  const endDate = new Date().toISOString().split('T')[0];
  let startDate: string;
  let label: string;

  switch (period) {
    case 'today':
      startDate = endDate;
      label = 'Today';
      break;
    case 'week':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      label = 'Last 7 Days';
      break;
    case 'year':
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      label = 'Last Year';
      break;
    case 'month':
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      label = 'Last 30 Days';
      break;
  }

  const [signatures, arb] = await Promise.all([
    getSignatureStats(db, { startDate, endDate }),
    getArbStats(db, { startDate, endDate }),
  ]);

  return {
    signatures,
    arb,
    period: { startDate, endDate, label },
  };
}
