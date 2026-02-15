/**
 * Unit tests for src/lib/portal-context.ts.
 *
 * Updated for Lucia session integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPortalContext } from '../../src/lib/portal-context';
import type { User, Session } from 'lucia';

function mockRequest(overrides?: Partial<Request>): Request {
  const headers = new Headers();
  headers.set('user-agent', 'Mozilla/5.0');
  headers.set('cf-connecting-ip', '192.168.1.1');
  return { headers, ...overrides } as unknown as Request;
}

function mockLuciaUser(email: string, role: string): User {
  return {
    id: email,
    email,
    role,
    status: 'active',
  } as User;
}

function mockLuciaSession(userId: string): Session {
  return {
    id: 'session-123',
    userId,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    fresh: true,
  } as Session;
}

describe('getPortalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns env and null session when no user in locals', async () => {
    const astro = {
      request: mockRequest(),
      locals: {
        runtime: { env: { DB: {} as unknown as D1Database } },
        user: null,
        session: null,
      },
    };
    const result = await getPortalContext(astro);
    expect(result.session).toBeNull();
    expect(result.env).toBeDefined();
    expect(result.effectiveRole).toBe('member');
  });

  it('returns session from Lucia user and session', async () => {
    const user = mockLuciaUser('user@example.com', 'member');
    const session = mockLuciaSession('user@example.com');

    const astro = {
      request: mockRequest(),
      locals: {
        runtime: { env: { SESSION_SECRET: 'secret' } },
        user,
        session,
      },
    };

    const result = await getPortalContext(astro);
    expect(result.session).toBeDefined();
    expect(result.session?.email).toBe('user@example.com');
    expect(result.session?.role).toBe('member');
    expect(result.session?.sessionId).toBe('session-123');
    expect(result.session?.csrfToken).toBe('session-123');
    expect(result.env).toBeDefined();
  });

  it('returns effective role as member when no elevation', async () => {
    const user = mockLuciaUser('board@example.com', 'board');
    const session = mockLuciaSession('board@example.com');

    const astro = {
      request: mockRequest(),
      locals: {
        runtime: { env: {} },
        user,
        session,
      },
    };

    const result = await getPortalContext(astro);
    expect(result.session?.role).toBe('board');
    expect(result.effectiveRole).toBe('member'); // No elevation = member
  });

  it('returns effective role when elevated', async () => {
    const user = mockLuciaUser('board@example.com', 'board');
    const session = {
      ...mockLuciaSession('board@example.com'),
      elevated_until: Date.now() + 3600000, // Elevated for 1 hour
    } as unknown as Session;

    const astro = {
      request: mockRequest(),
      locals: {
        runtime: { env: {} },
        user,
        session,
      },
    };

    const result = await getPortalContext(astro);
    expect(result.session?.role).toBe('board');
    expect(result.effectiveRole).toBe('board'); // Elevated = board
  });

  it('includes userAgent and ipAddress in result', async () => {
    const user = mockLuciaUser('user@example.com', 'member');
    const session = mockLuciaSession('user@example.com');

    const astro = {
      request: mockRequest(),
      locals: {
        runtime: { env: { SESSION_SECRET: 's' } },
        user,
        session,
      },
    };

    const result = await getPortalContext(astro);
    expect(result.userAgent).toBe('Mozilla/5.0');
    expect(result.ipAddress).toBe('192.168.1.1');
  });

  it('sets csrfToken to session ID for Lucia sessions', async () => {
    const user = mockLuciaUser('user@example.com', 'member');
    const session = mockLuciaSession('user@example.com');

    const astro = {
      request: mockRequest(),
      locals: {
        runtime: { env: {} },
        user,
        session,
      },
    };

    const result = await getPortalContext(astro);
    expect(result.session?.csrfToken).toBe('session-123');
    expect(result.session?.sessionId).toBe('session-123');
  });
});
