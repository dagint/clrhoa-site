/**
 * Rate Limiting Infrastructure
 *
 * Protects against brute force attacks and spam by limiting request frequency.
 * Uses Cloudflare D1 for persistent rate limit tracking across worker instances.
 *
 * Rate Limits:
 * - Login attempts: 5 per 15 minutes per email
 * - Password reset: 3 per hour per email
 * - Password setup: 3 per day per email
 * - Failed auth: 10 per hour per IP
 *
 * Usage:
 * ```typescript
 * import { checkRateLimit, RateLimitType } from './rate-limiter';
 *
 * const limited = await checkRateLimit(db, {
 *   type: RateLimitType.LOGIN,
 *   identifier: userEmail,
 *   ipAddress: request.headers.get('cf-connecting-ip'),
 * });
 *
 * if (limited.isLimited) {
 *   return { error: 'Too many attempts', retryAfter: limited.retryAfter };
 * }
 * ```
 */

/// <reference types="@cloudflare/workers-types" />

import { logSecurityEvent } from './audit-log';

/** Rate limit types with different thresholds */
export enum RateLimitType {
  LOGIN = 'login',
  PASSWORD_RESET = 'password_reset',
  PASSWORD_SETUP = 'password_setup',
  FAILED_AUTH = 'failed_auth',
}

/** Rate limit configuration */
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs?: number; // Optional lockout period after exceeding limit
}

/** Rate limit configurations by type */
const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  [RateLimitType.LOGIN]: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 15 * 60 * 1000, // 15 minute lockout
  },
  [RateLimitType.PASSWORD_RESET]: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutMs: 60 * 60 * 1000, // 1 hour lockout
  },
  [RateLimitType.PASSWORD_SETUP]: {
    maxAttempts: 3,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    lockoutMs: 24 * 60 * 60 * 1000, // 24 hour lockout
  },
  [RateLimitType.FAILED_AUTH]: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutMs: 60 * 60 * 1000, // 1 hour lockout
  },
};

/** Rate limit check request */
export interface RateLimitRequest {
  type: RateLimitType;
  identifier: string; // Email, IP, or other unique identifier
  ipAddress?: string; // For logging
  userAgent?: string; // For logging
  correlationId?: string; // For request tracing
}

/** Rate limit check result */
export interface RateLimitResult {
  isLimited: boolean;
  attemptsRemaining: number;
  retryAfter?: number; // Seconds until limit resets
  resetAt?: Date;
}

/**
 * Check if a request exceeds rate limits.
 *
 * @param db - D1 database instance
 * @param request - Rate limit check request
 * @returns Rate limit result
 */
export async function checkRateLimit(
  db: D1Database | undefined,
  request: RateLimitRequest
): Promise<RateLimitResult> {
  if (!db) {
    console.warn('[rate-limit] No database provided, rate limiting disabled');
    return {
      isLimited: false,
      attemptsRemaining: 999,
    };
  }

  const config = RATE_LIMIT_CONFIGS[request.type];
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  try {
    // Count attempts within the time window
    const result = await db
      .prepare(
        `SELECT COUNT(*) as count, MAX(attempted_at) as last_attempt
         FROM rate_limits
         WHERE rate_limit_type = ?
           AND identifier = ?
           AND attempted_at > ?`
      )
      .bind(request.type, request.identifier, windowStart.toISOString())
      .first<{ count: number; last_attempt: string | null }>();

    const attemptCount = result?.count || 0;
    const attemptsRemaining = Math.max(0, config.maxAttempts - attemptCount);

    // Check if currently locked out
    if (config.lockoutMs && result?.last_attempt) {
      const lastAttempt = new Date(result.last_attempt);
      const lockoutUntil = new Date(lastAttempt.getTime() + config.lockoutMs);

      if (now < lockoutUntil && attemptCount >= config.maxAttempts) {
        const retryAfter = Math.ceil((lockoutUntil.getTime() - now.getTime()) / 1000);

        // Log security event for rate limit exceeded
        await logSecurityEvent(db, {
          eventType: 'rate_limit_exceeded',
          severity: 'warning',
          userId: request.identifier.includes('@') ? request.identifier : undefined,
          ipAddress: request.ipAddress || null,
          userAgent: request.userAgent || null,
          correlationId: request.correlationId,
          details: {
            rateLimitType: request.type,
            attempts: attemptCount,
            maxAttempts: config.maxAttempts,
            windowMs: config.windowMs,
            lockoutUntil: lockoutUntil.toISOString(),
          },
        });

        return {
          isLimited: true,
          attemptsRemaining: 0,
          retryAfter,
          resetAt: lockoutUntil,
        };
      }
    }

    // Calculate when the window resets
    const resetAt = new Date(now.getTime() + config.windowMs);

    return {
      isLimited: attemptCount >= config.maxAttempts,
      attemptsRemaining,
      retryAfter: attemptCount >= config.maxAttempts
        ? Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
        : undefined,
      resetAt: attemptCount >= config.maxAttempts ? resetAt : undefined,
    };
  } catch (error) {
    console.error('[rate-limit] Failed to check rate limit:', error);
    // Fail open - don't block requests if rate limiting is broken
    return {
      isLimited: false,
      attemptsRemaining: 999,
    };
  }
}

/**
 * Record a rate limit attempt.
 *
 * @param db - D1 database instance
 * @param request - Rate limit request
 * @returns Promise that resolves when attempt is recorded
 */
export async function recordRateLimitAttempt(
  db: D1Database | undefined,
  request: RateLimitRequest
): Promise<void> {
  if (!db) {
    console.warn('[rate-limit] No database provided, skipping rate limit recording');
    return;
  }

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO rate_limits (
          id, rate_limit_type, identifier,
          attempted_at, ip_address, user_agent, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        request.type,
        request.identifier,
        now,
        request.ipAddress || null,
        request.userAgent || null,
        request.correlationId || null
      )
      .run();
  } catch (error) {
    console.error('[rate-limit] Failed to record rate limit attempt:', error);
    // Don't throw - recording failure shouldn't break the application
  }
}

/**
 * Clean up old rate limit records (retention policy enforcement).
 *
 * @param db - D1 database instance
 * @param retentionDays - Number of days to retain records (default: 30)
 * @returns Number of records deleted
 */
export async function cleanupRateLimits(
  db: D1Database,
  retentionDays: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffISO = cutoffDate.toISOString();

  try {
    const result = await db
      .prepare('DELETE FROM rate_limits WHERE attempted_at < ?')
      .bind(cutoffISO)
      .run();

    return result.meta?.changes || 0;
  } catch (error) {
    console.error('[rate-limit] Failed to clean up rate limits:', error);
    return 0;
  }
}

/**
 * Reset rate limits for a specific identifier.
 * Useful for admin override or testing.
 *
 * @param db - D1 database instance
 * @param type - Rate limit type to reset
 * @param identifier - Identifier to reset (email, IP, etc.)
 * @returns Number of records deleted
 */
export async function resetRateLimit(
  db: D1Database,
  type: RateLimitType,
  identifier: string
): Promise<number> {
  try {
    const result = await db
      .prepare('DELETE FROM rate_limits WHERE rate_limit_type = ? AND identifier = ?')
      .bind(type, identifier)
      .run();

    return result.meta?.changes || 0;
  } catch (error) {
    console.error('[rate-limit] Failed to reset rate limit:', error);
    return 0;
  }
}

/**
 * Get current rate limit status for an identifier.
 *
 * @param db - D1 database instance
 * @param type - Rate limit type
 * @param identifier - Identifier to check
 * @returns Rate limit status
 */
export async function getRateLimitStatus(
  db: D1Database,
  type: RateLimitType,
  identifier: string
): Promise<{
  attempts: number;
  maxAttempts: number;
  windowMs: number;
  oldestAttempt?: Date;
  newestAttempt?: Date;
}> {
  const config = RATE_LIMIT_CONFIGS[type];
  const windowStart = new Date(Date.now() - config.windowMs);

  try {
    const result = await db
      .prepare(
        `SELECT
          COUNT(*) as count,
          MIN(attempted_at) as oldest,
          MAX(attempted_at) as newest
         FROM rate_limits
         WHERE rate_limit_type = ?
           AND identifier = ?
           AND attempted_at > ?`
      )
      .bind(type, identifier, windowStart.toISOString())
      .first<{ count: number; oldest: string | null; newest: string | null }>();

    return {
      attempts: result?.count || 0,
      maxAttempts: config.maxAttempts,
      windowMs: config.windowMs,
      oldestAttempt: result?.oldest ? new Date(result.oldest) : undefined,
      newestAttempt: result?.newest ? new Date(result.newest) : undefined,
    };
  } catch (error) {
    console.error('[rate-limit] Failed to get rate limit status:', error);
    return {
      attempts: 0,
      maxAttempts: config.maxAttempts,
      windowMs: config.windowMs,
    };
  }
}
