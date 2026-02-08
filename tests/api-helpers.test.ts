/**
 * Unit tests for src/lib/api-helpers.ts (pure helpers only).
 */

import { describe, it, expect } from 'vitest';
import { jsonResponse, requireDb } from '../src/lib/api-helpers';


describe('jsonResponse', () => {
  it('returns Response with JSON body and Content-Type', async () => {
    const res = jsonResponse({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
  it('accepts custom status', () => {
    const res = jsonResponse({ error: 'Bad' }, 400);
    expect(res.status).toBe(400);
  });
});

describe('requireDb', () => {
  it('returns { response } when env or DB is missing', () => {
    const noEnv = requireDb(undefined);
    expect('response' in noEnv).toBe(true);
    if ('response' in noEnv) expect(noEnv.response.status).toBe(503);

    const noDb = requireDb({});
    expect('response' in noDb).toBe(true);
  });
  it('returns { db } when DB is present', () => {
    const mockDb = {} as unknown as D1Database;
    const out = requireDb({ DB: mockDb });
    expect('db' in out).toBe(true);
    if ('db' in out) expect(out.db).toBe(mockDb);
  });
});
