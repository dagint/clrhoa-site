/**
 * Session Management Utilities
 *
 * Enhanced session management with security features:
 * - Session fingerprinting (device/browser tracking)
 * - Session revocation (admin/security events)
 * - Activity tracking (idle timeout enforcement)
 * - IP address and user agent logging
 *
 * Usage:
 * ```typescript
 * import { createSession, validateSession, revokeSession } from './auth-session';
 *
 * // Create session with fingerprint
 * const session = await createSession(db, lucia, userId, ipAddress, userAgent);
 *
 * // Validate and update activity
 * const result = await validateSession(db, lucia, sessionId);
 * if (result.session) {
 *   console.log('Valid session for user:', result.user.email);
 * }
 *
 * // Revoke session
 * await revokeSession(db, lucia, sessionId, 'admin', 'Security policy violation');
 * ```
 */

/// <reference types="@cloudflare/workers-types" />

import type { Auth } from './lucia';
import type { User, Session } from 'lucia';
import { logSecurityEvent } from './audit-log';

/**
 * Session validation result
 */
export interface SessionValidationResult {
  session: Session | null;
  user: User | null;
}

/**
 * Generate session fingerprint from request metadata
 *
 * Creates a hash of user agent and IP to detect session hijacking.
 * Note: Fingerprints are not foolproof (IPs change, browsers update)
 * but provide an additional layer of security.
 *
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent string
 * @returns Fingerprint hash (first 32 chars of SHA-256)
 */
export async function generateSessionFingerprint(
  ipAddress: string | null,
  userAgent: string | null
): Promise<string | null> {
  if (!ipAddress && !userAgent) {
    return null;
  }

  const data = `${ipAddress || ''}|${userAgent || ''}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 32); // First 32 chars
}

/**
 * Create a new session with enhanced security tracking
 *
 * @param db - D1 database instance
 * @param lucia - Lucia auth instance
 * @param userId - User email (primary key)
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 * @returns Created session object
 */
export async function createSession(
  db: D1Database | undefined,
  lucia: Auth,
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<Session> {
  if (!db) {
    throw new Error('Database instance required');
  }

  // Generate fingerprint
  const fingerprint = await generateSessionFingerprint(ipAddress || null, userAgent || null);

  // Create session via Lucia
  const session = await lucia.createSession(userId, {});

  // Update session with additional metadata
  await db
    .prepare(
      `UPDATE sessions
       SET ip_address = ?,
           user_agent = ?,
           fingerprint = ?,
           last_activity = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(ipAddress || null, userAgent || null, fingerprint, session.id)
    .run();

  // Update user's last login timestamp
  await db
    .prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = ?')
    .bind(userId)
    .run();

  // Log session creation
  await logSecurityEvent(db, {
    eventType: 'session_created',
    severity: 'info',
    userId,
    sessionId: session.id,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    details: {
      fingerprint,
      expiresAt: session.expiresAt.toISOString(),
    },
  });

  return session;
}

/**
 * Validate session and update last activity timestamp
 *
 * Implements sliding window expiration: each validation extends the session
 * by another 15 minutes from the current time.
 *
 * @param db - D1 database instance
 * @param lucia - Lucia auth instance
 * @param sessionId - Session ID to validate
 * @param ipAddress - Current client IP (for fingerprint check)
 * @param userAgent - Current user agent (for fingerprint check)
 * @returns Session and user if valid, null otherwise
 */
export async function validateSession(
  db: D1Database | undefined,
  lucia: Auth,
  sessionId: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<SessionValidationResult> {
  if (!db) {
    return { session: null, user: null };
  }

  try {
    // Validate via Lucia (checks expiration, updates session if needed)
    const result = await lucia.validateSession(sessionId);

    if (!result.session || !result.user) {
      return { session: null, user: null };
    }

    // Check if session is revoked
    const sessionData = await db
      .prepare('SELECT is_active, fingerprint, revoked_at FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ is_active: number; fingerprint: string | null; revoked_at: string | null }>();

    if (!sessionData || sessionData.is_active === 0 || sessionData.revoked_at) {
      // Session revoked, invalidate it
      await lucia.invalidateSession(sessionId);
      return { session: null, user: null };
    }

    // Optional: Check fingerprint match (warn but don't block)
    if (sessionData.fingerprint) {
      const currentFingerprint = await generateSessionFingerprint(ipAddress || null, userAgent || null);
      if (currentFingerprint && currentFingerprint !== sessionData.fingerprint) {
        // Fingerprint mismatch - potential session hijacking
        await logSecurityEvent(db, {
          eventType: 'session_fingerprint_mismatch',
          severity: 'warning',
          userId: result.user.id, // user.id is the email
          sessionId,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          details: {
            expectedFingerprint: sessionData.fingerprint,
            actualFingerprint: currentFingerprint,
          },
        });

        // For now, allow but log. Future enhancement: revoke on mismatch
      }
    }

    // Update last activity timestamp (sliding window)
    await db
      .prepare('UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(sessionId)
      .run();

    return {
      session: result.session,
      user: result.user,
    };
  } catch (error) {
    console.error('[auth] Session validation failed:', error);
    return { session: null, user: null };
  }
}

/**
 * Revoke a session (logout or admin action)
 *
 * @param db - D1 database instance
 * @param lucia - Lucia auth instance
 * @param sessionId - Session ID to revoke
 * @param revokedBy - User or system that revoked the session
 * @param reason - Reason for revocation
 */
export async function revokeSession(
  db: D1Database | undefined,
  lucia: Auth,
  sessionId: string,
  revokedBy?: string,
  reason?: string
): Promise<void> {
  if (!db) {
    return;
  }

  try {
    // Get session info before revoking
    const session = await db
      .prepare('SELECT user_id FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ user_id: string }>();

    // Mark as revoked in database
    await db
      .prepare(
        `UPDATE sessions
         SET is_active = 0,
             revoked_at = CURRENT_TIMESTAMP,
             revoked_by = ?,
             revoke_reason = ?
         WHERE id = ?`
      )
      .bind(revokedBy || null, reason || null, sessionId)
      .run();

    // Invalidate via Lucia
    await lucia.invalidateSession(sessionId);

    // Log revocation
    if (session) {
      await logSecurityEvent(db, {
        eventType: 'session_revoked',
        severity: 'info',
        userId: session.user_id,
        sessionId,
        details: {
          revokedBy: revokedBy || 'system',
          reason: reason || 'manual_logout',
        },
      });
    }
  } catch (error) {
    console.error('[auth] Session revocation failed:', error);
  }
}

/**
 * Revoke all sessions for a user
 *
 * Useful for:
 * - Password changes (invalidate all existing sessions)
 * - Security incidents (force re-authentication)
 * - Account suspension
 *
 * @param db - D1 database instance
 * @param lucia - Lucia auth instance
 * @param userId - User email
 * @param revokedBy - Who initiated the revocation
 * @param reason - Reason for mass revocation
 */
export async function revokeAllUserSessions(
  db: D1Database | undefined,
  lucia: Auth,
  userId: string,
  revokedBy?: string,
  reason?: string
): Promise<number> {
  if (!db) {
    return 0;
  }

  try {
    // Get all active sessions for user
    const sessions = await db
      .prepare('SELECT id FROM sessions WHERE user_id = ? AND is_active = 1')
      .bind(userId)
      .all<{ id: string }>();

    if (!sessions.results || sessions.results.length === 0) {
      return 0;
    }

    // Revoke each session
    for (const session of sessions.results) {
      await revokeSession(db, lucia, session.id, revokedBy, reason);
    }

    // Log mass revocation
    await logSecurityEvent(db, {
      eventType: 'all_sessions_revoked',
      severity: 'warning',
      userId,
      details: {
        revokedBy: revokedBy || 'system',
        reason: reason || 'security_action',
        sessionCount: sessions.results.length,
      },
    });

    return sessions.results.length;
  } catch (error) {
    console.error('[auth] Mass session revocation failed:', error);
    return 0;
  }
}

/**
 * Cleanup expired sessions from database
 *
 * Should be run periodically (e.g., daily cron job) to prevent table bloat.
 *
 * @param db - D1 database instance
 * @param retentionDays - How many days to keep expired sessions (default: 30)
 * @returns Number of sessions deleted
 */
export async function cleanupExpiredSessions(
  db: D1Database | undefined,
  retentionDays: number = 30
): Promise<number> {
  if (!db) {
    return 0;
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db
      .prepare(
        `DELETE FROM sessions
         WHERE expires_at < ?
         OR (revoked_at IS NOT NULL AND revoked_at < ?)`
      )
      .bind(cutoffDate.toISOString(), cutoffDate.toISOString())
      .run();

    console.log(`[auth] Cleaned up ${result.meta.changes || 0} expired sessions`);
    return result.meta.changes || 0;
  } catch (error) {
    console.error('[auth] Session cleanup failed:', error);
    return 0;
  }
}
