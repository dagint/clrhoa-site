/**
 * Unit tests for session management utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateSessionFingerprint,
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  cleanupExpiredSessions,
} from '../../src/lib/auth-session';

describe('Session Management', () => {
  let mockDb: D1Database;
  let mockLucia: any;
  let preparedStatement: any;

  beforeEach(() => {
    preparedStatement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };

    mockDb = {
      prepare: vi.fn().mockReturnValue(preparedStatement),
    } as unknown as D1Database;

    mockLucia = {
      createSession: vi.fn().mockResolvedValue({
        id: 'session_123',
        userId: 'user@example.com',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        fresh: true,
      }),
      validateSession: vi.fn().mockResolvedValue({
        session: {
          id: 'session_123',
          userId: 'user@example.com',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          fresh: false,
        },
        user: {
          email: 'user@example.com',
          role: 'member',
          name: 'Test User',
          status: 'active',
          mfaEnabled: false,
        },
      }),
      invalidateSession: vi.fn().mockResolvedValue(undefined),
      createSessionCookie: vi.fn().mockReturnValue({
        name: 'clrhoa_session',
        value: 'session_123',
        attributes: {},
      }),
      createBlankSessionCookie: vi.fn().mockReturnValue({
        name: 'clrhoa_session',
        value: '',
        attributes: {},
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSessionFingerprint', () => {
    it('should generate consistent fingerprint for same inputs', async () => {
      const fp1 = await generateSessionFingerprint('1.2.3.4', 'Mozilla/5.0');
      const fp2 = await generateSessionFingerprint('1.2.3.4', 'Mozilla/5.0');

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(32);
    });

    it('should generate different fingerprints for different IPs', async () => {
      const fp1 = await generateSessionFingerprint('1.2.3.4', 'Mozilla/5.0');
      const fp2 = await generateSessionFingerprint('5.6.7.8', 'Mozilla/5.0');

      expect(fp1).not.toBe(fp2);
    });

    it('should generate different fingerprints for different user agents', async () => {
      const fp1 = await generateSessionFingerprint('1.2.3.4', 'Mozilla/5.0');
      const fp2 = await generateSessionFingerprint('1.2.3.4', 'Chrome/99.0');

      expect(fp1).not.toBe(fp2);
    });

    it('should return null if both IP and user agent are null', async () => {
      const fp = await generateSessionFingerprint(null, null);

      expect(fp).toBeNull();
    });

    it('should generate fingerprint with only IP', async () => {
      const fp = await generateSessionFingerprint('1.2.3.4', null);

      expect(fp).toBeTruthy();
      expect(fp).toHaveLength(32);
    });

    it('should generate fingerprint with only user agent', async () => {
      const fp = await generateSessionFingerprint(null, 'Mozilla/5.0');

      expect(fp).toBeTruthy();
      expect(fp).toHaveLength(32);
    });
  });

  describe('createSession', () => {
    it('should create session with metadata', async () => {
      const session = await createSession(
        mockDb,
        mockLucia,
        'user@example.com',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(session.id).toBe('session_123');
      expect(mockLucia.createSession).toHaveBeenCalledWith('user@example.com', {});
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions')
      );
    });

    it('should update user last_login', async () => {
      await createSession(mockDb, mockLucia, 'user@example.com', '1.2.3.4', 'Mozilla/5.0');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET last_login')
      );
    });

    it('should handle null IP and user agent', async () => {
      const session = await createSession(mockDb, mockLucia, 'user@example.com', null, null);

      expect(session.id).toBe('session_123');
    });

    it('should throw error if database is undefined', async () => {
      await expect(
        createSession(undefined, mockLucia, 'user@example.com', '1.2.3.4', 'Mozilla/5.0')
      ).rejects.toThrow('Database instance required');
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      preparedStatement.first.mockResolvedValue({
        is_active: 1,
        fingerprint: 'abc123',
        revoked_at: null,
      });

      const result = await validateSession(
        mockDb,
        mockLucia,
        'session_123',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.session).toBeTruthy();
      expect(result.user).toBeTruthy();
      expect(mockLucia.validateSession).toHaveBeenCalledWith('session_123');
    });

    it('should reject revoked session', async () => {
      preparedStatement.first.mockResolvedValue({
        is_active: 0,
        fingerprint: null,
        revoked_at: new Date().toISOString(),
      });

      const result = await validateSession(
        mockDb,
        mockLucia,
        'session_123',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.session).toBeNull();
      expect(result.user).toBeNull();
      expect(mockLucia.invalidateSession).toHaveBeenCalledWith('session_123');
    });

    it('should return null if Lucia validation fails', async () => {
      mockLucia.validateSession.mockResolvedValue({ session: null, user: null });

      const result = await validateSession(
        mockDb,
        mockLucia,
        'invalid_session',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.session).toBeNull();
      expect(result.user).toBeNull();
    });

    it('should update last_activity timestamp', async () => {
      preparedStatement.first.mockResolvedValue({
        is_active: 1,
        fingerprint: null,
        revoked_at: null,
      });

      await validateSession(mockDb, mockLucia, 'session_123', '1.2.3.4', 'Mozilla/5.0');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET last_activity')
      );
    });

    it('should handle database errors gracefully', async () => {
      preparedStatement.first.mockRejectedValue(new Error('Database error'));

      const result = await validateSession(
        mockDb,
        mockLucia,
        'session_123',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.session).toBeNull();
      expect(result.user).toBeNull();
    });

    it('should return null if database is undefined', async () => {
      const result = await validateSession(
        undefined,
        mockLucia,
        'session_123',
        '1.2.3.4',
        'Mozilla/5.0'
      );

      expect(result.session).toBeNull();
      expect(result.user).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('should revoke session with reason', async () => {
      preparedStatement.first.mockResolvedValue({
        user_id: 'user@example.com',
      });

      await revokeSession(mockDb, mockLucia, 'session_123', 'admin', 'Security violation');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions')
      );
      expect(mockLucia.invalidateSession).toHaveBeenCalledWith('session_123');
    });

    it('should handle null revokedBy and reason', async () => {
      preparedStatement.first.mockResolvedValue({
        user_id: 'user@example.com',
      });

      await revokeSession(mockDb, mockLucia, 'session_123');

      expect(mockLucia.invalidateSession).toHaveBeenCalledWith('session_123');
    });

    it('should handle database errors gracefully', async () => {
      preparedStatement.first.mockRejectedValue(new Error('Database error'));

      await expect(
        revokeSession(mockDb, mockLucia, 'session_123', 'admin', 'Test')
      ).resolves.not.toThrow();
    });

    it('should do nothing if database is undefined', async () => {
      await revokeSession(undefined, mockLucia, 'session_123', 'admin', 'Test');

      expect(mockLucia.invalidateSession).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all active sessions for user', async () => {
      preparedStatement.all.mockResolvedValue({
        results: [{ id: 'session_1' }, { id: 'session_2' }, { id: 'session_3' }],
      });

      preparedStatement.first.mockResolvedValue({
        user_id: 'user@example.com',
      });

      const count = await revokeAllUserSessions(
        mockDb,
        mockLucia,
        'user@example.com',
        'admin',
        'Password changed'
      );

      expect(count).toBe(3);
      expect(mockLucia.invalidateSession).toHaveBeenCalledTimes(3);
    });

    it('should return 0 if no active sessions', async () => {
      preparedStatement.all.mockResolvedValue({ results: [] });

      const count = await revokeAllUserSessions(
        mockDb,
        mockLucia,
        'user@example.com',
        'admin',
        'Test'
      );

      expect(count).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      preparedStatement.all.mockRejectedValue(new Error('Database error'));

      const count = await revokeAllUserSessions(
        mockDb,
        mockLucia,
        'user@example.com',
        'admin',
        'Test'
      );

      expect(count).toBe(0);
    });

    it('should return 0 if database is undefined', async () => {
      const count = await revokeAllUserSessions(
        undefined,
        mockLucia,
        'user@example.com',
        'admin',
        'Test'
      );

      expect(count).toBe(0);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      preparedStatement.run.mockResolvedValue({
        success: true,
        meta: { changes: 15 },
      });

      const count = await cleanupExpiredSessions(mockDb, 30);

      expect(count).toBe(15);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sessions')
      );
    });

    it('should use default retention of 30 days', async () => {
      preparedStatement.run.mockResolvedValue({
        success: true,
        meta: { changes: 5 },
      });

      const count = await cleanupExpiredSessions(mockDb);

      expect(count).toBe(5);
    });

    it('should return 0 if no sessions deleted', async () => {
      preparedStatement.run.mockResolvedValue({
        success: true,
        meta: { changes: 0 },
      });

      const count = await cleanupExpiredSessions(mockDb, 30);

      expect(count).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      preparedStatement.run.mockRejectedValue(new Error('Database error'));

      const count = await cleanupExpiredSessions(mockDb, 30);

      expect(count).toBe(0);
    });

    it('should return 0 if database is undefined', async () => {
      const count = await cleanupExpiredSessions(undefined, 30);

      expect(count).toBe(0);
    });
  });
});
