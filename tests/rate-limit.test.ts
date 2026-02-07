/**
 * Unit tests for src/lib/rate-limit.ts (pure getRateLimitConfig).
 */

import { describe, it, expect } from 'vitest';
import { getRateLimitConfig, RATE_LIMITS } from '../src/lib/rate-limit';

describe('getRateLimitConfig', () => {
  it('returns config for exact match', () => {
    const config = getRateLimitConfig('/api/login');
    expect(config).toEqual({ maxRequests: 5, windowSeconds: 15 * 60 });
  });

  it('returns config for arb endpoints', () => {
    expect(getRateLimitConfig('/api/arb-cancel')).toEqual({ maxRequests: 10, windowSeconds: 60 });
    expect(getRateLimitConfig('/api/arb-upload')).toEqual({ maxRequests: 10, windowSeconds: 60 * 60 });
  });

  it('returns default config for unknown endpoint', () => {
    const config = getRateLimitConfig('/api/unknown');
    expect(config).not.toBeNull();
    expect(config?.maxRequests).toBe(100);
    expect(config?.windowSeconds).toBe(60);
  });

  it('returns same config for prefix match when endpoint starts with key', () => {
    const config = getRateLimitConfig('/api/owners/upload-csv');
    expect(config).not.toBeNull();
    expect(config?.maxRequests).toBe(10);
  });
});

describe('RATE_LIMITS', () => {
  it('has expected endpoints', () => {
    expect(RATE_LIMITS['/api/login']).toBeDefined();
    expect(RATE_LIMITS['/api/arb-upload']).toBeDefined();
    expect(RATE_LIMITS['/api/log-phone-view']).toBeDefined();
  });

  it('has positive maxRequests and windowSeconds', () => {
    for (const config of Object.values(RATE_LIMITS)) {
      expect(config.maxRequests).toBeGreaterThan(0);
      expect(config.windowSeconds).toBeGreaterThan(0);
    }
  });
});
