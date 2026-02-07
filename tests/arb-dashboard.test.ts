/**
 * Unit tests for src/lib/arb-dashboard.ts (pure helpers).
 */

import { describe, it, expect } from 'vitest';
import {
  getYearQuarter,
  formatApproval,
  selectedTypes,
  isImageFilename,
  getFileViewUrl,
  getFileViewerUrl,
} from '../src/lib/arb-dashboard';

describe('getYearQuarter', () => {
  it('returns YYYY-Qn from date string', () => {
    expect(getYearQuarter('2026-02-15')).toBe('2026-Q1'); // Feb = month 1
    expect(getYearQuarter('2026-05-15')).toBe('2026-Q2');  // May = month 4
  });
  it('uses current date when null', () => {
    const q = getYearQuarter(null);
    expect(q).toMatch(/^\d{4}-Q[1-4]$/);
  });
});

describe('formatApproval', () => {
  it('parses approved esign', () => {
    const r = formatApproval('approved | Jane Doe | jane@example.com | 2026-01-10', '2026-01-10');
    expect(r?.status).toBe('approved');
    expect(r?.by).toBe('Jane Doe');
    expect(r?.date).toMatch(/January/);
    expect(r?.date).toMatch(/2026/);
  });
  it('parses rejected esign', () => {
    const r = formatApproval('rejected | Board | board@example.com | 2026-01-09', null);
    expect(r?.status).toBe('rejected');
  });
  it('returns null for empty or invalid', () => {
    expect(formatApproval(null, null)).toBeNull();
    expect(formatApproval('', null)).toBeNull();
    expect(formatApproval('pending | x', null)).toBeNull();
  });
});

describe('selectedTypes', () => {
  it('splits comma-separated and trims', () => {
    expect(selectedTypes('Exterior Paint, Fencing')).toEqual(['Exterior Paint', 'Fencing']);
  });
  it('returns empty array for null or empty', () => {
    expect(selectedTypes(null)).toEqual([]);
    expect(selectedTypes('')).toEqual([]);
  });
});

describe('isImageFilename', () => {
  it('returns true for image extensions', () => {
    expect(isImageFilename('photo.jpg')).toBe(true);
    expect(isImageFilename('img.PNG')).toBe(true);
    expect(isImageFilename('file.webp')).toBe(true);
  });
  it('returns false for non-images', () => {
    expect(isImageFilename('doc.pdf')).toBe(false);
    expect(isImageFilename('file.txt')).toBe(false);
  });
});

describe('getFileViewUrl / getFileViewerUrl', () => {
  it('extracts first key from r2_keys JSON', () => {
    const json = JSON.stringify({ originals: ['arb/req1/file.pdf'] });
    expect(getFileViewUrl(json)).toBe('/api/portal/file/arb%2Freq1%2Ffile.pdf');
    expect(getFileViewerUrl(json)).toContain('file-view?key=');
  });
  it('returns null for invalid JSON or empty', () => {
    expect(getFileViewUrl('')).toBeNull();
    expect(getFileViewUrl('{}')).toBeNull();
  });
});
