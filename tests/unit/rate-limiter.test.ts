/**
 * Unit tests for rate limiting infrastructure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  recordRateLimitAttempt,
  cleanupRateLimits,
  resetRateLimit,
  getRateLimitStatus,
  RateLimitType,
} from '../../src/lib/rate-limiter';

describe('Rate Limiting', () => {
  let mockDb: D1Database;
  let preparedStatement: any;

  beforeEach(() => {
    // Mock D1 prepared statement
    preparedStatement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
    };

    // Mock D1 database
    mockDb = {
      prepare: vi.fn().mockReturnValue(preparedStatement),
    } as unknown as D1Database;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', async () => {
      // Mock 2 attempts out of 5 allowed
      preparedStatement.first.mockResolvedValue({
        count: 2,
        last_attempt: new Date().toISOString(),
      });

      const result = await checkRateLimit(mockDb, {
        type: RateLimitType.LOGIN,
        identifier: 'user@example.com',
      });

      expect(result.isLimited).toBe(false);
      expect(result.attemptsRemaining).toBe(3); // 5 - 2 = 3
    });

    it('should block requests at the limit', async () => {
      // Mock 5 attempts out of 5 allowed
      preparedStatement.first.mockResolvedValue({
        count: 5,
        last_attempt: new Date().toISOString(),
      });

      const result = await checkRateLimit(mockDb, {
        type: RateLimitType.LOGIN,
        identifier: 'user@example.com',
      });

      expect(result.isLimited).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should enforce lockout period', async () => {
      const lastAttempt = new Date();
      preparedStatement.first.mockResolvedValue({
        count: 5,
        last_attempt: lastAttempt.toISOString(),
      });

      const result = await checkRateLimit(mockDb, {
        type: RateLimitType.LOGIN,
        identifier: 'user@example.com',
        ipAddress: '1.2.3.4',
      });

      expect(result.isLimited).toBe(true);
      expect(result.retryAfter).toBeLessThanOrEqual(15 * 60); // Max 15 minutes
    });

    it('should handle password reset rate limits (3/hour)', async () => {
      preparedStatement.first.mockResolvedValue({
        count: 2,
        last_attempt: new Date().toISOString(),
      });

      const result = await checkRateLimit(mockDb, {
        type: RateLimitType.PASSWORD_RESET,
        identifier: 'user@example.com',
      });

      expect(result.isLimited).toBe(false);
      expect(result.attemptsRemaining).toBe(1); // 3 - 2 = 1
    });

    it('should handle no database gracefully', async () => {
      const result = await checkRateLimit(undefined, {
        type: RateLimitType.LOGIN,
        identifier: 'user@example.com',
      });

      expect(result.isLimited).toBe(false);
      expect(result.attemptsRemaining).toBe(999);
    });

    it('should fail open on database error', async () => {
      preparedStatement.first.mockRejectedValue(new Error('Database error'));

      const result = await checkRateLimit(mockDb, {
        type: RateLimitType.LOGIN,
        identifier: 'user@example.com',
      });

      expect(result.isLimited).toBe(false);
      expect(result.attemptsRemaining).toBe(999);
    });
  });

  describe('recordRateLimitAttempt', () => {
    it('should record attempt with all fields', async () => {
      await recordRateLimitAttempt(mockDb, {
        type: RateLimitType.LOGIN,
        identifier: 'user@example.com',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        correlationId: 'corr-123',
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO rate_limits')
      );
      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String), // id (UUID)
        RateLimitType.LOGIN,
        'user@example.com',
        expect.any(String), // attempted_at (ISO 8601)
        '1.2.3.4',
        'Mozilla/5.0',
        'corr-123'
      );
      expect(preparedStatement.run).toHaveBeenCalled();
    });

    it('should handle missing optional fields', async () => {
      await recordRateLimitAttempt(mockDb, {
        type: RateLimitType.PASSWORD_RESET,
        identifier: 'user@example.com',
      });

      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String),
        RateLimitType.PASSWORD_RESET,
        'user@example.com',
        expect.any(String),
        null,
        null,
        null
      );
    });

    it('should handle no database gracefully', async () => {
      await expect(
        recordRateLimitAttempt(undefined, {
          type: RateLimitType.LOGIN,
          identifier: 'user@example.com',
        })
      ).resolves.not.toThrow();
    });

    it('should not throw on database error', async () => {
      preparedStatement.run.mockRejectedValue(new Error('Database error'));

      await expect(
        recordRateLimitAttempt(mockDb, {
          type: RateLimitType.LOGIN,
          identifier: 'user@example.com',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('cleanupRateLimits', () => {
    it('should delete old rate limit records', async () => {
      preparedStatement.run.mockResolvedValue({ success: true, meta: { changes: 42 } });

      const deleted = await cleanupRateLimits(mockDb, 30);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'DELETE FROM rate_limits WHERE attempted_at < ?'
      );
      expect(preparedStatement.bind).toHaveBeenCalledWith(expect.any(String)); // ISO date
      expect(deleted).toBe(42);
    });

    it('should use default retention of 30 days', async () => {
      await cleanupRateLimits(mockDb);

      expect(preparedStatement.bind).toHaveBeenCalledWith(expect.any(String));
    });

    it('should return 0 on error', async () => {
      preparedStatement.run.mockRejectedValue(new Error('Database error'));

      const deleted = await cleanupRateLimits(mockDb);

      expect(deleted).toBe(0);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limits for identifier', async () => {
      preparedStatement.run.mockResolvedValue({ success: true, meta: { changes: 5 } });

      const deleted = await resetRateLimit(mockDb, RateLimitType.LOGIN, 'user@example.com');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'DELETE FROM rate_limits WHERE rate_limit_type = ? AND identifier = ?'
      );
      expect(preparedStatement.bind).toHaveBeenCalledWith(
        RateLimitType.LOGIN,
        'user@example.com'
      );
      expect(deleted).toBe(5);
    });

    it('should return 0 on error', async () => {
      preparedStatement.run.mockRejectedValue(new Error('Database error'));

      const deleted = await resetRateLimit(mockDb, RateLimitType.LOGIN, 'user@example.com');

      expect(deleted).toBe(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      const now = new Date();
      preparedStatement.first.mockResolvedValue({
        count: 3,
        oldest: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 min ago
        newest: now.toISOString(),
      });

      const status = await getRateLimitStatus(mockDb, RateLimitType.LOGIN, 'user@example.com');

      expect(status.attempts).toBe(3);
      expect(status.maxAttempts).toBe(5);
      expect(status.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(status.oldestAttempt).toBeInstanceOf(Date);
      expect(status.newestAttempt).toBeInstanceOf(Date);
    });

    it('should handle no attempts', async () => {
      preparedStatement.first.mockResolvedValue({
        count: 0,
        oldest: null,
        newest: null,
      });

      const status = await getRateLimitStatus(mockDb, RateLimitType.LOGIN, 'user@example.com');

      expect(status.attempts).toBe(0);
      expect(status.oldestAttempt).toBeUndefined();
      expect(status.newestAttempt).toBeUndefined();
    });

    it('should return default status on error', async () => {
      preparedStatement.first.mockRejectedValue(new Error('Database error'));

      const status = await getRateLimitStatus(mockDb, RateLimitType.LOGIN, 'user@example.com');

      expect(status.attempts).toBe(0);
      expect(status.maxAttempts).toBe(5);
    });
  });
});
