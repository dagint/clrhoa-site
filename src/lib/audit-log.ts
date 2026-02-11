/**
 * Audit Logging Infrastructure
 *
 * Comprehensive audit logging for authentication, authorization, and administrative events.
 * All security-relevant actions are logged for compliance, incident response, and monitoring.
 *
 * Usage:
 * ```typescript
 * import { logAuthEvent, logSecurityEvent, logAdminEvent } from './audit-log';
 *
 * // Log authentication events
 * await logAuthEvent(env.DB, {
 *   eventType: 'login_success',
 *   userId: user.email,
 *   ipAddress: request.headers.get('cf-connecting-ip'),
 *   userAgent: request.headers.get('user-agent'),
 *   correlationId: context.locals.correlationId,
 * });
 *
 * // Log security events
 * await logSecurityEvent(env.DB, {
 *   eventType: 'rate_limit_exceeded',
 *   severity: 'warning',
 *   userId: user.email,
 *   ipAddress,
 *   details: { attempts: 5, window: '15min' },
 * });
 * ```
 */

/// <reference types="@cloudflare/workers-types" />

import { generateCorrelationId } from './logging';

/** Event categories for audit logs */
export type EventCategory =
  | 'authentication'  // Login, logout, password changes
  | 'authorization'   // Permission checks, access denials
  | 'administrative'  // User creation, role changes, config changes
  | 'security';       // Rate limits, suspicious activity

/** Event severity levels */
export type EventSeverity = 'info' | 'warning' | 'critical';

/** Event outcome */
export type EventOutcome = 'success' | 'failure' | 'denied';

/** Base audit log entry */
export interface AuditLogEntry {
  // Event classification
  eventType: string;         // e.g., 'login_success', 'password_change', 'role_assigned'
  eventCategory: EventCategory;
  severity?: EventSeverity;  // Defaults to 'info'

  // Actor (who performed the action)
  userId?: string | null;           // Email of user who performed action (null for unauthenticated)

  // Target (who was affected)
  targetUserId?: string | null;     // Email of user affected (for admin operations)

  // Request context
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  correlationId?: string;

  // Action details
  action: string;            // Human-readable action description
  outcome?: EventOutcome;    // Defaults to 'success'

  // Additional context (JSON)
  details?: Record<string, any> | null;

  // Resource information
  resourceType?: string | null;     // e.g., 'user', 'session', 'role', 'permission'
  resourceId?: string | null;       // ID of affected resource
}

/** Security event (subset of audit log for critical security monitoring) */
export interface SecurityEventEntry {
  eventType: string;         // e.g., 'rate_limit_exceeded', 'account_locked', 'suspicious_login'
  severity: EventSeverity;   // 'info', 'warning', or 'critical'

  userId?: string | null;           // Affected user email
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  correlationId?: string;

  details?: Record<string, any> | null;

  // Auto-remediation tracking
  autoRemediated?: boolean;
  remediationAction?: string | null; // e.g., 'account_locked', 'session_revoked', 'ip_blocked'
}

/**
 * Generate a unique audit log ID (UUID v4)
 */
function generateAuditId(): string {
  return crypto.randomUUID();
}

/**
 * Log an audit event to the database.
 *
 * @param db - D1 database instance
 * @param entry - Audit log entry
 * @returns Promise that resolves when log is written
 */
export async function logAuditEvent(
  db: D1Database | undefined,
  entry: AuditLogEntry
): Promise<void> {
  if (!db) {
    console.warn('[audit] No database provided, skipping audit log');
    return;
  }

  const id = generateAuditId();
  const timestamp = new Date().toISOString();
  const severity = entry.severity || 'info';
  const outcome = entry.outcome || 'success';
  const correlationId = entry.correlationId || generateCorrelationId();

  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (
          id, timestamp, event_type, event_category, severity,
          user_id, target_user_id,
          ip_address, user_agent, session_id, correlation_id,
          action, outcome, details,
          resource_type, resource_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        timestamp,
        entry.eventType,
        entry.eventCategory,
        severity,
        entry.userId || null,
        entry.targetUserId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.sessionId || null,
        correlationId,
        entry.action,
        outcome,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.resourceType || null,
        entry.resourceId || null
      )
      .run();
  } catch (error) {
    // Log to console but don't throw - auditing failure shouldn't break application
    console.error('[audit] Failed to write audit log:', error);
    console.error('[audit] Entry:', entry);
  }
}

/**
 * Log an authentication event (login, logout, password change, etc.)
 *
 * @param db - D1 database instance
 * @param event - Partial audit entry (category and severity auto-set)
 */
export async function logAuthEvent(
  db: D1Database | undefined,
  event: Omit<AuditLogEntry, 'eventCategory' | 'severity'>
): Promise<void> {
  await logAuditEvent(db, {
    ...event,
    eventCategory: 'authentication',
    severity: event.outcome === 'failure' || event.outcome === 'denied' ? 'warning' : 'info',
  });
}

/**
 * Log an authorization event (permission check, access denial)
 *
 * @param db - D1 database instance
 * @param event - Partial audit entry (category auto-set)
 */
export async function logAuthorizationEvent(
  db: D1Database | undefined,
  event: Omit<AuditLogEntry, 'eventCategory'>
): Promise<void> {
  await logAuditEvent(db, {
    ...event,
    eventCategory: 'authorization',
  });
}

/**
 * Log an administrative event (user creation, role change, config update)
 *
 * @param db - D1 database instance
 * @param event - Partial audit entry (category auto-set)
 */
export async function logAdminEvent(
  db: D1Database | undefined,
  event: Omit<AuditLogEntry, 'eventCategory'>
): Promise<void> {
  await logAuditEvent(db, {
    ...event,
    eventCategory: 'administrative',
  });
}

/**
 * Log a security event to both audit_logs and security_events tables.
 * Security events are high-priority events that require monitoring and potential response.
 *
 * @param db - D1 database instance
 * @param event - Security event entry
 */
export async function logSecurityEvent(
  db: D1Database | undefined,
  event: SecurityEventEntry
): Promise<void> {
  if (!db) {
    console.warn('[audit] No database provided, skipping security event log');
    return;
  }

  const correlationId = event.correlationId || generateCorrelationId();

  // Log to audit_logs for comprehensive audit trail
  await logAuditEvent(db, {
    eventType: event.eventType,
    eventCategory: 'security',
    severity: event.severity,
    userId: event.userId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    sessionId: event.sessionId,
    correlationId,
    action: `Security event: ${event.eventType}`,
    outcome: 'success', // Security events are observations, not actions
    details: event.details,
    resourceType: 'security',
    resourceId: event.eventType,
  });

  // Also log to security_events for specialized monitoring
  const id = generateAuditId();
  const timestamp = new Date().toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO security_events (
          id, timestamp, event_type, severity,
          user_id, ip_address, user_agent, session_id, correlation_id,
          details, auto_remediated, remediation_action,
          resolved, resolved_by, resolved_at, resolution_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        timestamp,
        event.eventType,
        event.severity,
        event.userId || null,
        event.ipAddress || null,
        event.userAgent || null,
        event.sessionId || null,
        correlationId,
        event.details ? JSON.stringify(event.details) : null,
        event.autoRemediated ? 1 : 0,
        event.remediationAction || null,
        0, // resolved = false by default
        null, // resolved_by
        null, // resolved_at
        null // resolution_notes
      )
      .run();
  } catch (error) {
    console.error('[audit] Failed to write security event:', error);
    console.error('[audit] Event:', event);
  }
}

/**
 * Query audit logs with filtering.
 *
 * @param db - D1 database instance
 * @param filters - Query filters
 * @returns Audit log entries
 */
export async function queryAuditLogs(
  db: D1Database,
  filters: {
    userId?: string;
    targetUserId?: string;
    eventType?: string;
    eventCategory?: EventCategory;
    severity?: EventSeverity;
    outcome?: EventOutcome;
    ipAddress?: string;
    correlationId?: string;
    startDate?: string; // ISO 8601
    endDate?: string;   // ISO 8601
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  const conditions: string[] = [];
  const bindings: any[] = [];

  if (filters.userId) {
    conditions.push('user_id = ?');
    bindings.push(filters.userId);
  }

  if (filters.targetUserId) {
    conditions.push('target_user_id = ?');
    bindings.push(filters.targetUserId);
  }

  if (filters.eventType) {
    conditions.push('event_type = ?');
    bindings.push(filters.eventType);
  }

  if (filters.eventCategory) {
    conditions.push('event_category = ?');
    bindings.push(filters.eventCategory);
  }

  if (filters.severity) {
    conditions.push('severity = ?');
    bindings.push(filters.severity);
  }

  if (filters.outcome) {
    conditions.push('outcome = ?');
    bindings.push(filters.outcome);
  }

  if (filters.ipAddress) {
    conditions.push('ip_address = ?');
    bindings.push(filters.ipAddress);
  }

  if (filters.correlationId) {
    conditions.push('correlation_id = ?');
    bindings.push(filters.correlationId);
  }

  if (filters.startDate) {
    conditions.push('timestamp >= ?');
    bindings.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('timestamp <= ?');
    bindings.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT * FROM audit_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const result = await db
      .prepare(query)
      .bind(...bindings, limit, offset)
      .all();

    return result.results || [];
  } catch (error) {
    console.error('[audit] Failed to query audit logs:', error);
    console.error('[audit] Filters:', filters);
    return [];
  }
}

/**
 * Query security events with filtering.
 *
 * @param db - D1 database instance
 * @param filters - Query filters
 * @returns Security event entries
 */
export async function querySecurityEvents(
  db: D1Database,
  filters: {
    userId?: string;
    eventType?: string;
    severity?: EventSeverity;
    resolved?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  const conditions: string[] = [];
  const bindings: any[] = [];

  if (filters.userId) {
    conditions.push('user_id = ?');
    bindings.push(filters.userId);
  }

  if (filters.eventType) {
    conditions.push('event_type = ?');
    bindings.push(filters.eventType);
  }

  if (filters.severity) {
    conditions.push('severity = ?');
    bindings.push(filters.severity);
  }

  if (filters.resolved !== undefined) {
    conditions.push('resolved = ?');
    bindings.push(filters.resolved ? 1 : 0);
  }

  if (filters.startDate) {
    conditions.push('timestamp >= ?');
    bindings.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('timestamp <= ?');
    bindings.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT * FROM security_events
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const result = await db
      .prepare(query)
      .bind(...bindings, limit, offset)
      .all();

    return result.results || [];
  } catch (error) {
    console.error('[audit] Failed to query security events:', error);
    console.error('[audit] Filters:', filters);
    return [];
  }
}

/**
 * Clean up old audit logs (retention policy enforcement).
 *
 * @param db - D1 database instance
 * @param retentionDays - Number of days to retain logs (default: 365)
 * @returns Number of logs deleted
 */
export async function cleanupAuditLogs(
  db: D1Database,
  retentionDays: number = 365
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffISO = cutoffDate.toISOString();

  const result = await db
    .prepare('DELETE FROM audit_logs WHERE timestamp < ?')
    .bind(cutoffISO)
    .run();

  return result.meta?.changes || 0;
}

/**
 * Clean up old resolved security events.
 *
 * @param db - D1 database instance
 * @param retentionDays - Number of days to retain resolved events (default: 730 = 2 years)
 * @returns Number of events deleted
 */
export async function cleanupSecurityEvents(
  db: D1Database,
  retentionDays: number = 730
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffISO = cutoffDate.toISOString();

  const result = await db
    .prepare('DELETE FROM security_events WHERE timestamp < ? AND resolved = 1')
    .bind(cutoffISO)
    .run();

  return result.meta?.changes || 0;
}
