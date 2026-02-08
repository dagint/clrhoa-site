/**
 * Unit tests for src/lib/access-control.ts (with mocked getArbRequest).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getArbRequest } from '../src/lib/arb-db';
import { listEmailsAtSameAddress } from '../src/lib/directory-db';
import { requireArbRequestAccess, requireArbRequestOwner } from '../src/lib/access-control';

vi.mock('../src/lib/arb-db', () => ({
  getArbRequest: vi.fn(),
}));

vi.mock('../src/lib/directory-db', () => ({
  listEmailsAtSameAddress: vi.fn(),
}));

const mockDb = {} as unknown as D1Database;

const sessionOwner = {
  email: 'owner@example.com',
  role: 'member',
  name: 'Owner',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const sessionBoard = {
  email: 'board@example.com',
  role: 'board',
  name: 'Board',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const sessionOther = {
  email: 'other@example.com',
  role: 'member',
  name: 'Other',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const mockRequest = {
  id: 'ARB-2026-0001',
  owner_email: 'owner@example.com',
  applicant_name: null,
  phone: null,
  property_address: null,
  application_type: null,
  description: 'Test',
  status: 'pending',
  esign_timestamp: null,
  arb_esign: null,
  created: '',
  updated_at: null,
};

describe('requireArbRequestAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEmailsAtSameAddress).mockImplementation((_db, email) =>
      Promise.resolve([email.trim().toLowerCase()])
    );
  });

  it('returns 404 when request not found', async () => {
    vi.mocked(getArbRequest).mockResolvedValue(null);
    const result = await requireArbRequestAccess(mockDb, 'ARB-2026-0001', sessionOwner);
    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(404);
  });

  it('returns request when user is owner', async () => {
    vi.mocked(getArbRequest).mockResolvedValue({ ...mockRequest } as any);
    const result = await requireArbRequestAccess(mockDb, 'ARB-2026-0001', sessionOwner);
    expect('request' in result).toBe(true);
    if ('request' in result) expect(result.request.owner_email).toBe('owner@example.com');
  });

  it('returns request when user is elevated (board)', async () => {
    vi.mocked(getArbRequest).mockResolvedValue({ ...mockRequest } as any);
    const result = await requireArbRequestAccess(mockDb, 'ARB-2026-0001', sessionBoard);
    expect('request' in result).toBe(true);
  });

  it('returns 403 when user is neither owner nor elevated', async () => {
    vi.mocked(getArbRequest).mockResolvedValue({ ...mockRequest } as any);
    const result = await requireArbRequestAccess(mockDb, 'ARB-2026-0001', sessionOther);
    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(403);
  });
});

describe('requireArbRequestOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listEmailsAtSameAddress).mockImplementation((_db, email) =>
      Promise.resolve([email.trim().toLowerCase()])
    );
  });

  it('returns 404 when request not found', async () => {
    vi.mocked(getArbRequest).mockResolvedValue(null);
    const result = await requireArbRequestOwner(mockDb, 'ARB-2026-0001', sessionOwner);
    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(404);
  });

  it('returns 403 when user is not owner', async () => {
    vi.mocked(getArbRequest).mockResolvedValue({ ...mockRequest } as any);
    const result = await requireArbRequestOwner(mockDb, 'ARB-2026-0001', sessionOther);
    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(403);
  });

  it('returns request when user is owner and no requirePending', async () => {
    vi.mocked(getArbRequest).mockResolvedValue({ ...mockRequest } as any);
    const result = await requireArbRequestOwner(mockDb, 'ARB-2026-0001', sessionOwner);
    expect('request' in result).toBe(true);
  });

  it('returns 400 when requirePending and status is not pending', async () => {
    vi.mocked(getArbRequest).mockResolvedValue({ ...mockRequest, status: 'in_review' } as any);
    const result = await requireArbRequestOwner(mockDb, 'ARB-2026-0001', sessionOwner, { requirePending: true });
    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response.status).toBe(400);
  });

  it('returns request when owner and status is pending', async () => {
    vi.mocked(getArbRequest).mockResolvedValue({ ...mockRequest, status: 'pending' } as any);
    const result = await requireArbRequestOwner(mockDb, 'ARB-2026-0001', sessionOwner, { requirePending: true });
    expect('request' in result).toBe(true);
  });
});
