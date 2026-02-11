/**
 * Unit tests for security utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateSecureToken,
  hashToken,
  validatePasswordStrength,
  checkAccountLockout,
  recordFailedLoginAttempt,
  resetFailedLoginAttempts,
  detectSuspiciousActivity,
} from '../../src/lib/security-utils';

describe('Security Utilities', () => {
  describe('generateSecureToken', () => {
    it('should generate a hex token of correct length', async () => {
      const token = await generateSecureToken(32);

      expect(token).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
      expect(token.length).toBe(64);
    });

    it('should generate different tokens each time', async () => {
      const token1 = await generateSecureToken();
      const token2 = await generateSecureToken();

      expect(token1).not.toBe(token2);
    });

    it('should support custom lengths', async () => {
      const token = await generateSecureToken(16);

      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });
  });

  describe('hashToken', () => {
    it('should hash a token to SHA-256', async () => {
      const token = 'my-secret-token';
      const hash = await hashToken(token);

      expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 = 64 hex chars
    });

    it('should produce consistent hashes', async () => {
      const token = 'my-secret-token';
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', async () => {
      const hash1 = await hashToken('token1');
      const hash2 = await hashToken('token2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const result = validatePasswordStrength('MyS3cure!P@ssw0rd');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThanOrEqual(4);
    });

    it('should reject password too short', () => {
      const result = validatePasswordStrength('Short1!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('mysecure!passw0rd');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('MYSECURE!PASSW0RD');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      const result = validatePasswordStrength('MySecure!Password');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      const result = validatePasswordStrength('MySecurePassw0rd');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*)');
    });

    it('should reject common passwords', () => {
      const result = validatePasswordStrength('Password123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common');
    });

    it('should warn about repeating characters', () => {
      const result = validatePasswordStrength('MyS3cure!!!Passs');

      expect(result.suggestions).toContain('Avoid repeating characters (e.g., "aaa", "111")');
    });

    it('should warn about keyboard patterns', () => {
      const result = validatePasswordStrength('Qwerty123456!@#');

      expect(result.suggestions).toContain('Avoid keyboard patterns');
    });

    it('should give higher score for longer passwords', () => {
      const short = validatePasswordStrength('MyS3cure!P@ss');
      const long = validatePasswordStrength('MyS3cure!P@ssw0rdIsVeryLong');

      expect(long.score).toBeGreaterThanOrEqual(short.score);
    });
  });

  describe('checkAccountLockout', () => {
    let mockDb: D1Database;
    let preparedStatement: any;

    beforeEach(() => {
      preparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
      };

      mockDb = {
        prepare: vi.fn().mockReturnValue(preparedStatement),
      } as unknown as D1Database;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return not locked for user with no lockout', async () => {
      preparedStatement.first.mockResolvedValue({
        locked_until: null,
        failed_login_attempts: 2,
      });

      const result = await checkAccountLockout(mockDb, 'user@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(2);
      expect(result.maxAttempts).toBe(5);
    });

    it('should return locked for user within lockout period', async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      preparedStatement.first.mockResolvedValue({
        locked_until: future.toISOString(),
        failed_login_attempts: 5,
      });

      const result = await checkAccountLockout(mockDb, 'user@example.com');

      expect(result.isLocked).toBe(true);
      expect(result.lockedUntil).toBeInstanceOf(Date);
      expect(result.failedAttempts).toBe(5);
    });

    it('should reset lockout if period has expired', async () => {
      const past = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      preparedStatement.first.mockResolvedValue({
        locked_until: past.toISOString(),
        failed_login_attempts: 5,
      });

      const result = await checkAccountLockout(mockDb, 'user@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(0); // Reset
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users')
      );
    });

    it('should handle user not found', async () => {
      preparedStatement.first.mockResolvedValue(null);

      const result = await checkAccountLockout(mockDb, 'nonexistent@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(0);
    });

    it('should handle no database gracefully', async () => {
      const result = await checkAccountLockout(undefined, 'user@example.com');

      expect(result.isLocked).toBe(false);
    });

    it('should fail open on database error', async () => {
      preparedStatement.first.mockRejectedValue(new Error('Database error'));

      const result = await checkAccountLockout(mockDb, 'user@example.com');

      expect(result.isLocked).toBe(false);
    });
  });

  describe('recordFailedLoginAttempt', () => {
    let mockDb: D1Database;
    let preparedStatement: any;

    beforeEach(() => {
      preparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
      };

      mockDb = {
        prepare: vi.fn().mockReturnValue(preparedStatement),
      } as unknown as D1Database;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should increment failed attempts', async () => {
      preparedStatement.first.mockResolvedValue({
        failed_login_attempts: 2,
      });

      const result = await recordFailedLoginAttempt(mockDb, 'user@example.com');

      expect(result.failedAttempts).toBe(2);
      expect(result.isLocked).toBe(false);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = failed_login_attempts + 1')
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      preparedStatement.first.mockResolvedValue({
        failed_login_attempts: 5,
      });

      const result = await recordFailedLoginAttempt(
        mockDb,
        'user@example.com',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.isLocked).toBe(true);
      expect(result.lockedUntil).toBeInstanceOf(Date);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET locked_until = ?')
      );
    });

    it('should handle no database gracefully', async () => {
      const result = await recordFailedLoginAttempt(undefined, 'user@example.com');

      expect(result.isLocked).toBe(false);
    });
  });

  describe('resetFailedLoginAttempts', () => {
    let mockDb: D1Database;
    let preparedStatement: any;

    beforeEach(() => {
      preparedStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb = {
        prepare: vi.fn().mockReturnValue(preparedStatement),
      } as unknown as D1Database;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should reset failed attempts to 0', async () => {
      await resetFailedLoginAttempts(mockDb, 'user@example.com');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = 0')
      );
      expect(preparedStatement.bind).toHaveBeenCalledWith('user@example.com');
    });

    it('should handle no database gracefully', async () => {
      await expect(
        resetFailedLoginAttempts(undefined, 'user@example.com')
      ).resolves.not.toThrow();
    });
  });

  describe('detectSuspiciousActivity', () => {
    let mockDb: D1Database;
    let preparedStatement: any;

    beforeEach(() => {
      preparedStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };

      mockDb = {
        prepare: vi.fn().mockReturnValue(preparedStatement),
      } as unknown as D1Database;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should flag login from new IP', async () => {
      preparedStatement.all.mockResolvedValue({
        results: [
          { ip_address: '1.2.3.4', user_agent: 'Mozilla/5.0' },
          { ip_address: '1.2.3.5', user_agent: 'Mozilla/5.0' },
        ],
      });

      const result = await detectSuspiciousActivity(
        mockDb,
        'user@example.com',
        '9.9.9.9', // New IP
        'Mozilla/5.0'
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.reasons).toContain('login_from_new_ip');
    });

    it('should flag login from new device', async () => {
      preparedStatement.all.mockResolvedValue({
        results: [
          { ip_address: '1.2.3.4', user_agent: 'Mozilla/5.0' },
        ],
      });

      const result = await detectSuspiciousActivity(
        mockDb,
        'user@example.com',
        '1.2.3.4',
        'Chrome/99.0' // New user agent
      );

      expect(result.isSuspicious).toBe(true);
      expect(result.reasons).toContain('login_from_new_device');
    });

    it('should not flag login from known IP and device', async () => {
      preparedStatement.all.mockResolvedValue({
        results: [
          { ip_address: '1.2.3.4', user_agent: 'Mozilla/5.0' },
        ],
      });

      const result = await detectSuspiciousActivity(
        mockDb,
        'user@example.com',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.isSuspicious).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should handle no login history', async () => {
      preparedStatement.all.mockResolvedValue({ results: [] });

      const result = await detectSuspiciousActivity(
        mockDb,
        'user@example.com',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.isSuspicious).toBe(false);
    });

    it('should handle missing IP or user agent', async () => {
      const result = await detectSuspiciousActivity(
        mockDb,
        'user@example.com',
        null,
        null
      );

      expect(result.isSuspicious).toBe(false);
    });

    it('should handle no database gracefully', async () => {
      const result = await detectSuspiciousActivity(
        undefined,
        'user@example.com',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.isSuspicious).toBe(false);
    });
  });
});
