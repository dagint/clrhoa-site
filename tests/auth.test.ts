/**
 * Unit tests for auth helpers that are pure (no crypto/KV).
 */

import { describe, it, expect } from 'vitest';
import {
  isElevatedRole,
  ELEVATED_ROLES,
  VALID_ROLES,
  generateSessionFingerprint,
  verifySessionFingerprint,
} from '../src/lib/auth';

describe('isElevatedRole', () => {
  it('returns true for arb, board, arb_board, admin', () => {
    expect(isElevatedRole('arb')).toBe(true);
    expect(isElevatedRole('board')).toBe(true);
    expect(isElevatedRole('arb_board')).toBe(true);
    expect(isElevatedRole('admin')).toBe(true);
  });
  it('returns false for member and unknown', () => {
    expect(isElevatedRole('member')).toBe(false);
    expect(isElevatedRole('')).toBe(false);
    expect(isElevatedRole('viewer')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(isElevatedRole('ADMIN')).toBe(true);
    expect(isElevatedRole('Board')).toBe(true);
  });
});

describe('ELEVATED_ROLES / VALID_ROLES', () => {
  it('ELEVATED_ROLES contains expected roles', () => {
    expect(ELEVATED_ROLES.has('arb')).toBe(true);
    expect(ELEVATED_ROLES.has('board')).toBe(true);
    expect(ELEVATED_ROLES.has('admin')).toBe(true);
    expect(ELEVATED_ROLES.has('member')).toBe(false);
  });
  it('VALID_ROLES includes member', () => {
    expect(VALID_ROLES.has('member')).toBe(true);
    expect(VALID_ROLES.has('arb')).toBe(true);
  });
});

describe('generateSessionFingerprint', () => {
  it('returns deterministic hash for same inputs', () => {
    const a = generateSessionFingerprint('Mozilla/5.0', '192.168.1.1');
    const b = generateSessionFingerprint('Mozilla/5.0', '192.168.1.1');
    expect(a).toBe(b);
  });
  it('returns different hash for different inputs', () => {
    const a = generateSessionFingerprint('Mozilla', '1.1.1.1');
    const b = generateSessionFingerprint('Chrome', '1.1.1.1');
    expect(a).not.toBe(b);
  });
  it('handles null userAgent and ipAddress', () => {
    const fp = generateSessionFingerprint(null, null);
    expect(typeof fp).toBe('string');
    expect(fp.length).toBeGreaterThan(0);
  });
});

describe('verifySessionFingerprint', () => {
  it('returns true when fingerprint matches current request', () => {
    const ua = 'Mozilla/5.0';
    const ip = '10.0.0.1';
    const fp = generateSessionFingerprint(ua, ip);
    expect(verifySessionFingerprint(fp, ua, ip)).toBe(true);
  });
  it('returns false when fingerprint does not match', () => {
    const fp = generateSessionFingerprint('Mozilla', '1.2.3.4');
    expect(verifySessionFingerprint(fp, 'Chrome', '1.2.3.4')).toBe(false);
  });
  it('returns true when session has no fingerprint (legacy)', () => {
    expect(verifySessionFingerprint(undefined, 'Mozilla', '1.2.3.4')).toBe(true);
  });
});
