/**
 * Unit tests for password storage and hashing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  checkPasswordHistory,
  updatePassword,
  needsRehash,
  rehashIfNeeded,
  generateTemporaryPassword,
  clearPasswordHistory,
} from '../../src/lib/password';

describe('Password Storage & Hashing', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'MySecureP@ssw0rd123';
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt format
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'MySecureP@ssw0rd123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
    });

    it('should handle special characters', async () => {
      const password = 'P@$$w0rd!#%&*()[]{}';
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(100);
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'MySecureP@ssw0rd123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecureP@ssw0rd123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword123!', hash);

      expect(isValid).toBe(false);
    });

    it('should be case sensitive', async () => {
      const password = 'MySecureP@ssw0rd123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('mysecurep@ssw0rd123', hash);

      expect(isValid).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const isValid = await verifyPassword('password', 'invalid-hash');

      expect(isValid).toBe(false);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('ValidPassword123!');
      const isValid = await verifyPassword('', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('checkPasswordHistory', () => {
    let mockDb: D1Database;
    let preparedStatement: any;

    beforeEach(() => {
      preparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };

      mockDb = {
        prepare: vi.fn().mockReturnValue(preparedStatement),
      } as unknown as D1Database;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should detect reused current password', async () => {
      const password = 'MySecureP@ssw0rd123';
      const hash = await hashPassword(password);

      preparedStatement.first.mockResolvedValue({
        password_hash: hash,
        previous_password_hashes: null,
      });

      const reused = await checkPasswordHistory(mockDb, 'user@example.com', password);

      expect(reused).toBe(true);
    });

    it('should detect reused password from history', async () => {
      const oldPassword = 'OldP@ssw0rd123';
      const oldHash = await hashPassword(oldPassword);
      const currentHash = await hashPassword('CurrentP@ssw0rd123');

      preparedStatement.first.mockResolvedValue({
        password_hash: currentHash,
        previous_password_hashes: JSON.stringify([oldHash]),
      });

      const reused = await checkPasswordHistory(mockDb, 'user@example.com', oldPassword);

      expect(reused).toBe(true);
    });

    it('should allow new password not in history', async () => {
      const hash1 = await hashPassword('OldP@ssw0rd123');
      const hash2 = await hashPassword('CurrentP@ssw0rd123');

      preparedStatement.first.mockResolvedValue({
        password_hash: hash2,
        previous_password_hashes: JSON.stringify([hash1]),
      });

      const reused = await checkPasswordHistory(mockDb, 'user@example.com', 'NewP@ssw0rd123');

      expect(reused).toBe(false);
    });

    it('should handle user without password', async () => {
      preparedStatement.first.mockResolvedValue({
        password_hash: null,
        previous_password_hashes: null,
      });

      const reused = await checkPasswordHistory(mockDb, 'user@example.com', 'AnyP@ssw0rd');

      expect(reused).toBe(false);
    });

    it('should handle user not found', async () => {
      preparedStatement.first.mockResolvedValue(null);

      const reused = await checkPasswordHistory(mockDb, 'nonexistent@example.com', 'password');

      expect(reused).toBe(false);
    });

    it('should handle invalid password history JSON', async () => {
      preparedStatement.first.mockResolvedValue({
        password_hash: await hashPassword('CurrentP@ssw0rd'),
        previous_password_hashes: 'invalid-json',
      });

      const reused = await checkPasswordHistory(mockDb, 'user@example.com', 'NewP@ssw0rd');

      expect(reused).toBe(false); // Should not throw, just return false
    });

    it('should handle no database gracefully', async () => {
      const reused = await checkPasswordHistory(undefined, 'user@example.com', 'password');

      expect(reused).toBe(false);
    });
  });

  describe('updatePassword', () => {
    let mockDb: D1Database;
    let preparedStatement: any;

    beforeEach(() => {
      preparedStatement = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockDb = {
        prepare: vi.fn().mockReturnValue(preparedStatement),
      } as unknown as D1Database;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should update password and add old password to history', async () => {
      const oldHash = await hashPassword('OldP@ssw0rd123');

      preparedStatement.first.mockResolvedValue({
        password_hash: oldHash,
        previous_password_hashes: null,
      });

      const success = await updatePassword(mockDb, 'user@example.com', 'NewP@ssw0rd123');

      expect(success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users')
      );

      const bindCall = preparedStatement.bind.mock.calls[1]; // Second call (first is SELECT)
      expect(bindCall[0]).toMatch(/^\$2[aby]\$\d{2}\$/); // New hash
      const previousHashes = JSON.parse(bindCall[1]);
      expect(previousHashes).toHaveLength(1);
      expect(previousHashes[0]).toBe(oldHash);
    });

    it('should limit password history to 5 entries', async () => {
      const hashes = await Promise.all([
        hashPassword('Pass1'),
        hashPassword('Pass2'),
        hashPassword('Pass3'),
        hashPassword('Pass4'),
        hashPassword('Pass5'),
      ]);

      preparedStatement.first.mockResolvedValue({
        password_hash: await hashPassword('Pass6'),
        previous_password_hashes: JSON.stringify(hashes),
      });

      const success = await updatePassword(mockDb, 'user@example.com', 'Pass7');

      expect(success).toBe(true);

      const bindCall = preparedStatement.bind.mock.calls[1];
      const previousHashes = JSON.parse(bindCall[1]);
      expect(previousHashes).toHaveLength(5); // Should be limited to 5
    });

    it('should handle user without existing password', async () => {
      preparedStatement.first.mockResolvedValue({
        password_hash: null,
        previous_password_hashes: null,
      });

      const success = await updatePassword(mockDb, 'user@example.com', 'FirstP@ssw0rd');

      expect(success).toBe(true);
    });

    it('should handle user not found', async () => {
      preparedStatement.first.mockResolvedValue(null);

      const success = await updatePassword(mockDb, 'nonexistent@example.com', 'password');

      expect(success).toBe(false);
    });

    it('should handle no database gracefully', async () => {
      const success = await updatePassword(undefined, 'user@example.com', 'password');

      expect(success).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('should detect hash with lower cost factor', async () => {
      // Generate hash with cost 8 (lower than default 10)
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.genSalt(8);
      const hash = await bcrypt.hash('password', salt);

      const needs = await needsRehash(hash);

      expect(needs).toBe(true);
    });

    it('should not rehash current cost factor', async () => {
      const hash = await hashPassword('password');
      const needs = await needsRehash(hash);

      expect(needs).toBe(false);
    });

    it('should detect invalid hash format', async () => {
      const needs = await needsRehash('invalid-hash');

      expect(needs).toBe(true);
    });
  });

  describe('rehashIfNeeded', () => {
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

    it('should rehash password with low cost factor', async () => {
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.genSalt(8);
      const oldHash = await bcrypt.hash('password', salt);

      const rehashed = await rehashIfNeeded(mockDb, 'user@example.com', 'password', oldHash);

      expect(rehashed).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users')
      );
    });

    it('should not rehash current hash', async () => {
      const hash = await hashPassword('password');

      const rehashed = await rehashIfNeeded(mockDb, 'user@example.com', 'password', hash);

      expect(rehashed).toBe(false);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should handle no database gracefully', async () => {
      const hash = await hashPassword('password');

      const rehashed = await rehashIfNeeded(undefined, 'user@example.com', 'password', hash);

      expect(rehashed).toBe(false);
    });
  });

  describe('generateTemporaryPassword', () => {
    it('should generate password with correct format', async () => {
      const password = await generateTemporaryPassword();

      // Format: Word-Word-4digits-Symbol
      expect(password).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}[!@#$%&*]$/);
    });

    it('should generate different passwords', async () => {
      const pass1 = await generateTemporaryPassword();
      const pass2 = await generateTemporaryPassword();

      // Very unlikely to be the same (but technically possible)
      expect(pass1).not.toBe(pass2);
    });

    it('should be 4+ different passwords', async () => {
      const passwords = await Promise.all([
        generateTemporaryPassword(),
        generateTemporaryPassword(),
        generateTemporaryPassword(),
        generateTemporaryPassword(),
      ]);

      const uniquePasswords = new Set(passwords);
      expect(uniquePasswords.size).toBeGreaterThanOrEqual(4);
    });
  });

  describe('clearPasswordHistory', () => {
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

    it('should clear password history', async () => {
      await clearPasswordHistory(mockDb, 'user@example.com');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('previous_password_hashes = NULL')
      );
      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String), // timestamp
        'user@example.com'
      );
    });

    it('should handle no database gracefully', async () => {
      await expect(
        clearPasswordHistory(undefined, 'user@example.com')
      ).resolves.not.toThrow();
    });
  });
});
