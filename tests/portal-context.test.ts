/**
 * Unit tests for src/lib/portal-context.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSessionFromCookie } from '../src/lib/auth';
import { getPortalContext } from '../src/lib/portal-context';

vi.mock('../src/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/auth')>();
  return {
    ...actual,
    getSessionFromCookie: vi.fn(),
  };
});

function mockRequest(overrides?: Partial<Request>): Request {
  const headers = new Headers();
  headers.set('cookie', 'clrhoa_session=abc');
  headers.set('user-agent', 'Mozilla/5.0');
  headers.set('cf-connecting-ip', '192.168.1.1');
  return { headers, ...overrides } as unknown as Request;
}

describe('getPortalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns env and null session when no SESSION_SECRET', async () => {
    const astro = {
      request: mockRequest(),
      locals: { runtime: { env: { DB: {} } } },
    };
    const result = await getPortalContext(astro);
    expect(result.session).toBeNull();
    expect(result.env).toBeDefined();
    expect(vi.mocked(getSessionFromCookie)).not.toHaveBeenCalled();
  });

  it('returns null session when getSessionFromCookie returns null', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null);
    const astro = {
      request: mockRequest(),
      locals: { runtime: { env: { SESSION_SECRET: 'secret' } } },
    };
    const result = await getPortalContext(astro);
    expect(result.session).toBeNull();
    expect((result.env as unknown as { SESSION_SECRET?: string })?.SESSION_SECRET).toBe('secret');
    expect(vi.mocked(getSessionFromCookie)).toHaveBeenCalledWith(
      expect.any(String),
      'secret'
    );
  });

  it('returns session when getSessionFromCookie returns session', async () => {
    const session = {
      email: 'u@example.com',
      role: 'member',
      name: 'User',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    vi.mocked(getSessionFromCookie).mockResolvedValue(session);
    const astro = {
      request: mockRequest(),
      locals: { runtime: { env: { SESSION_SECRET: 'secret' } } },
    };
    const result = await getPortalContext(astro);
    expect(result.session).toEqual(session);
    expect((result.env as unknown as { SESSION_SECRET?: string })?.SESSION_SECRET).toBe('secret');
  });

  it('with fingerprint: true passes userAgent and ipAddress', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null);
    const astro = {
      request: mockRequest(),
      locals: { runtime: { env: { SESSION_SECRET: 's' } } },
    };
    await getPortalContext(astro, { fingerprint: true });
    expect(vi.mocked(getSessionFromCookie)).toHaveBeenCalledWith(
      expect.any(String),
      's',
      'Mozilla/5.0',
      '192.168.1.1'
    );
  });

  it('includes userAgent and ipAddress in result', async () => {
    vi.mocked(getSessionFromCookie).mockResolvedValue(null);
    const astro = {
      request: mockRequest(),
      locals: { runtime: { env: { SESSION_SECRET: 's' } } },
    };
    const result = await getPortalContext(astro);
    expect(result.userAgent).toBe('Mozilla/5.0');
    expect(result.ipAddress).toBe('192.168.1.1');
  });
});
