/**
 * Session Management Utilities
 *
 * Handles session creation, validation, and revocation.
 * Integrates with Lucia for session lifecycle management.
 */

import type { Lucia } from 'lucia';
import { createLucia } from './index';

/**
 * Session creation options
 */
export interface SessionOptions {
  /** IP address of the client */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Session duration in seconds (default: 30 days) */
  expiresInSeconds?: number;
}

/**
 * Session fingerprint for security validation using Web Crypto API
 */
async function generateSessionFingerprint(ipAddress: string, userAgent: string): Promise<string> {
  const data = `${ipAddress}:${userAgent}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Use Web Crypto API (available in Cloudflare Workers)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Create a new session for a user.
 *
 * @param db - D1 database instance
 * @param lucia - Lucia instance
 * @param userId - User email (used as user ID)
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 * @returns Created session object
 */
export async function createSession(
  db: D1Database,
  lucia: Lucia,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  // Create session with Lucia
  const session = await lucia.createSession(userId, {
    fingerprint: await generateSessionFingerprint(ipAddress || 'unknown', userAgent || 'unknown'),
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    createdAt: Math.floor(Date.now() / 1000),
  });

  return session;
}

/**
 * Validate a session by ID.
 *
 * @param db - D1 database instance
 * @param lucia - Lucia instance
 * @param sessionId - Session ID to validate
 * @returns Session and user if valid, null if invalid/expired
 */
export async function validateSession(db: D1Database, lucia: Lucia, sessionId: string) {
  return await lucia.validateSession(sessionId);
}

/**
 * Revoke (invalidate) a session.
 *
 * @param db - D1 database instance
 * @param lucia - Lucia instance
 * @param sessionId - Session ID to revoke
 */
export async function revokeSession(
  db: D1Database,
  lucia: Lucia,
  sessionId: string,
  revokedBy?: 'user' | 'admin' | 'system',
  reason?: string
) {
  await lucia.invalidateSession(sessionId);

  // Log revocation in security_events for audit trail
  await db
    .prepare(
      `INSERT INTO security_events (
        id,
        event_type,
        severity,
        session_id,
        details,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(
      globalThis.crypto.randomUUID(),
      'session_revoked',
      'info',
      sessionId,
      JSON.stringify({ revoked_by: revokedBy, reason })
    )
    .run();
}

/**
 * Revoke all sessions for a user.
 *
 * @param db - D1 database instance
 * @param lucia - Lucia instance
 * @param userId - User ID (email) whose sessions to revoke
 */
export async function revokeAllUserSessions(db: D1Database, lucia: Lucia, userId: string) {
  await lucia.invalidateUserSessions(userId);

  // Log revocation in security_events for audit trail
  await db
    .prepare(
      `INSERT INTO security_events (
        id,
        event_type,
        severity,
        user_id,
        details,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(
      globalThis.crypto.randomUUID(),
      'all_sessions_revoked',
      'info',
      userId,
      JSON.stringify({ reason: 'admin_action' })
    )
    .run();
}
