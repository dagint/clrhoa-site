/**
 * Unit tests for audit logging infrastructure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logAuditEvent,
  logAuthEvent,
  logAuthorizationEvent,
  logAdminEvent,
  logSecurityEvent,
  queryAuditLogs,
  querySecurityEvents,
  cleanupAuditLogs,
  cleanupSecurityEvents,
  type EventCategory,
  type EventSeverity,
} from '../../src/lib/audit-log';

describe('Audit Logging', () => {
  let mockDb: D1Database;
  let preparedStatement: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Mock D1 prepared statement
    preparedStatement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
    };

    // Mock D1 database
    mockDb = {
      prepare: vi.fn().mockReturnValue(preparedStatement),
    } as unknown as D1Database;

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('logAuditEvent', () => {
    it('should log an audit event with all fields', async () => {
      await logAuditEvent(mockDb, {
        eventType: 'login_success',
        eventCategory: 'authentication',
        severity: 'info',
        userId: 'user@example.com',
        targetUserId: null,
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session-123',
        correlationId: 'corr-456',
        action: 'User logged in successfully',
        outcome: 'success',
        details: { method: 'email' },
        resourceType: 'session',
        resourceId: 'session-123',
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'));
      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String), // id (UUID)
        expect.any(String), // timestamp (ISO 8601)
        'login_success',
        'authentication',
        'info',
        'user@example.com',
        null,
        '1.2.3.4',
        'Mozilla/5.0',
        'session-123',
        'corr-456',
        'User logged in successfully',
        'success',
        JSON.stringify({ method: 'email' }),
        'session',
        'session-123'
      );
      expect(preparedStatement.run).toHaveBeenCalled();
    });

    it('should use default values for optional fields', async () => {
      await logAuditEvent(mockDb, {
        eventType: 'test_event',
        eventCategory: 'administrative',
        action: 'Test action',
      });

      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String), // id
        expect.any(String), // timestamp
        'test_event',
        'administrative',
        'info', // default severity
        null, // no userId
        null, // no targetUserId
        null, // no ipAddress
        null, // no userAgent
        null, // no sessionId
        expect.any(String), // correlationId (auto-generated)
        'Test action',
        'success', // default outcome
        null, // no details
        null, // no resourceType
        null  // no resourceId
      );
    });

    it('should log to console and not throw on database error', async () => {
      preparedStatement.run.mockRejectedValue(new Error('Database error'));

      await expect(
        logAuditEvent(mockDb, {
          eventType: 'test',
          eventCategory: 'administrative',
          action: 'Test',
        })
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[audit] Failed to write audit log:',
        expect.any(Error)
      );
    });

    it('should warn and skip if no database provided', async () => {
      await logAuditEvent(undefined, {
        eventType: 'test',
        eventCategory: 'administrative',
        action: 'Test',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[audit] No database provided, skipping audit log'
      );
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });
  });

  describe('logAuthEvent', () => {
    it('should log authentication event with auto-set category', async () => {
      await logAuthEvent(mockDb, {
        eventType: 'login_success',
        userId: 'user@example.com',
        action: 'User logged in',
        outcome: 'success',
      });

      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'login_success',
        'authentication', // auto-set
        'info', // auto-set (success = info)
        'user@example.com',
        null,
        null,
        null,
        null,
        expect.any(String),
        'User logged in',
        'success',
        null,
        null,
        null
      );
    });

    it('should set severity to warning for failed auth', async () => {
      await logAuthEvent(mockDb, {
        eventType: 'login_failed',
        userId: 'user@example.com',
        action: 'Login failed',
        outcome: 'failure',
      });

      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'login_failed',
        'authentication',
        'warning', // auto-set (failure = warning)
        'user@example.com',
        null,
        null,
        null,
        null,
        expect.any(String),
        'Login failed',
        'failure',
        null,
        null,
        null
      );
    });

    it('should set severity to warning for denied auth', async () => {
      await logAuthEvent(mockDb, {
        eventType: 'access_denied',
        userId: 'user@example.com',
        action: 'Access denied',
        outcome: 'denied',
      });

      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'access_denied',
        'authentication',
        'warning', // auto-set (denied = warning)
        'user@example.com',
        null,
        null,
        null,
        null,
        expect.any(String),
        'Access denied',
        'denied',
        null,
        null,
        null
      );
    });
  });

  describe('logAuthorizationEvent', () => {
    it('should log authorization event with auto-set category', async () => {
      await logAuthorizationEvent(mockDb, {
        eventType: 'access_denied',
        userId: 'user@example.com',
        action: 'Access denied to /admin',
        outcome: 'denied',
        severity: 'warning',
      });

      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'access_denied',
        'authorization', // auto-set
        'warning',
        'user@example.com',
        null,
        null,
        null,
        null,
        expect.any(String),
        'Access denied to /admin',
        'denied',
        null,
        null,
        null
      );
    });
  });

  describe('logAdminEvent', () => {
    it('should log administrative event with auto-set category', async () => {
      await logAdminEvent(mockDb, {
        eventType: 'role_change',
        userId: 'admin@example.com',
        targetUserId: 'user@example.com',
        action: 'Changed user role from member to admin',
        severity: 'info',
        details: { oldRole: 'member', newRole: 'admin' },
      });

      expect(preparedStatement.bind).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'role_change',
        'administrative', // auto-set
        'info',
        'admin@example.com',
        'user@example.com',
        null,
        null,
        null,
        expect.any(String),
        'Changed user role from member to admin',
        'success',
        JSON.stringify({ oldRole: 'member', newRole: 'admin' }),
        null,
        null
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log to both audit_logs and security_events tables', async () => {
      await logSecurityEvent(mockDb, {
        eventType: 'rate_limit_exceeded',
        severity: 'warning',
        userId: 'user@example.com',
        ipAddress: '1.2.3.4',
        details: { attempts: 5, window: '15min' },
      });

      // Should call prepare twice (once for audit_logs, once for security_events)
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO security_events'));
    });

    it('should include auto-remediation info', async () => {
      await logSecurityEvent(mockDb, {
        eventType: 'account_locked',
        severity: 'critical',
        userId: 'user@example.com',
        autoRemediated: true,
        remediationAction: 'account_locked',
      });

      // Check security_events call includes remediation fields
      const securityEventsCall = preparedStatement.bind.mock.calls[1];
      expect(securityEventsCall).toContain(1); // autoRemediated = true (1)
      expect(securityEventsCall).toContain('account_locked'); // remediationAction
    });
  });

  describe('queryAuditLogs', () => {
    it('should query audit logs with filters', async () => {
      await queryAuditLogs(mockDb, {
        userId: 'user@example.com',
        eventCategory: 'authentication',
        severity: 'warning',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
        limit: 50,
        offset: 10,
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND event_category = ? AND severity = ? AND timestamp >= ? AND timestamp <= ?')
      );
      expect(preparedStatement.bind).toHaveBeenCalledWith(
        'user@example.com',
        'authentication',
        'warning',
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z',
        50,
        10
      );
      expect(preparedStatement.all).toHaveBeenCalled();
    });

    it('should use default limit and offset', async () => {
      await queryAuditLogs(mockDb, {});

      expect(preparedStatement.bind).toHaveBeenCalledWith(100, 0);
    });

    it('should return empty array and log error on database failure', async () => {
      preparedStatement.all.mockRejectedValue(new Error('Database error'));

      const result = await queryAuditLogs(mockDb, {
        userId: 'user@example.com',
      });

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[audit] Failed to query audit logs:',
        expect.any(Error)
      );
    });
  });

  describe('querySecurityEvents', () => {
    it('should query security events with filters', async () => {
      await querySecurityEvents(mockDb, {
        severity: 'critical',
        resolved: false,
        limit: 25,
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE severity = ? AND resolved = ?')
      );
      expect(preparedStatement.bind).toHaveBeenCalledWith('critical', 0, 25, 0);
    });

    it('should return empty array and log error on database failure', async () => {
      preparedStatement.all.mockRejectedValue(new Error('Database error'));

      const result = await querySecurityEvents(mockDb, {
        severity: 'critical',
      });

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[audit] Failed to query security events:',
        expect.any(Error)
      );
    });
  });

  describe('cleanupAuditLogs', () => {
    it('should delete old audit logs', async () => {
      preparedStatement.run.mockResolvedValue({ success: true, meta: { changes: 42 } });

      const deleted = await cleanupAuditLogs(mockDb, 365);

      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM audit_logs WHERE timestamp < ?');
      expect(preparedStatement.bind).toHaveBeenCalledWith(expect.any(String)); // ISO date
      expect(deleted).toBe(42);
    });

    it('should use default retention of 365 days', async () => {
      await cleanupAuditLogs(mockDb);

      expect(preparedStatement.bind).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('cleanupSecurityEvents', () => {
    it('should delete old resolved security events', async () => {
      preparedStatement.run.mockResolvedValue({ success: true, meta: { changes: 15 } });

      const deleted = await cleanupSecurityEvents(mockDb, 730);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'DELETE FROM security_events WHERE timestamp < ? AND resolved = 1'
      );
      expect(deleted).toBe(15);
    });

    it('should use default retention of 730 days', async () => {
      await cleanupSecurityEvents(mockDb);

      expect(preparedStatement.bind).toHaveBeenCalledWith(expect.any(String));
    });
  });
});
