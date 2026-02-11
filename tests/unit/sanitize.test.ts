/**
 * Unit tests for src/lib/sanitize.ts — XSS and path traversal prevention.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeText,
  sanitizeForDisplay,
  sanitizeFileName,
  sanitizeEmail,
  sanitizePhone,
  sanitizeForScriptInjection,
} from '../../src/lib/sanitize';

describe('escapeHtml', () => {
  it('escapes & < > " and single quote', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHtml("'single'")).toBe('&#039;single&#039;');
  });
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('sanitizeText', () => {
  it('strips HTML tags and escapes', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
  });
  it('returns empty for null/undefined', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });
});

describe('sanitizeForDisplay', () => {
  it('delegates to sanitizeText', () => {
    expect(sanitizeForDisplay('<p>test</p>')).toBe('test');
  });
});

describe('sanitizeFileName', () => {
  it('replaces path separators and dangerous chars', () => {
    expect(sanitizeFileName('foo/bar')).toBe('foo_bar');
    expect(sanitizeFileName('..\\file')).toBe('__file');
    expect(sanitizeFileName('.hidden')).toBe('_hidden');
  });
  it('prevents path traversal', () => {
    expect(sanitizeFileName('../../../etc/passwd')).toContain('_');
    expect(sanitizeFileName('../../../etc/passwd')).not.toContain('..');
  });
  it('returns "file" for empty/null/undefined', () => {
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName(null)).toBe('file');
    expect(sanitizeFileName(undefined)).toBe('file');
  });
  it('truncates to 255 chars', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeFileName(long).length).toBe(255);
  });
});

describe('sanitizeEmail', () => {
  it('accepts valid emails', () => {
    expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
    expect(sanitizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });
  it('rejects invalid emails', () => {
    expect(sanitizeEmail('notanemail')).toBeNull();
    expect(sanitizeEmail('@nodomain.com')).toBeNull();
    expect(sanitizeEmail('nodomain@')).toBeNull();
    expect(sanitizeEmail('')).toBeNull();
    expect(sanitizeEmail(null)).toBeNull();
    expect(sanitizeEmail(undefined)).toBeNull();
  });
});

describe('sanitizePhone', () => {
  it('strips non-digits but keeps + - ( ) and spaces', () => {
    expect(sanitizePhone('(555) 123-4567')).toBe('(555) 123-4567');
    expect(sanitizePhone('+1 555 123 4567')).toBeTruthy();
  });
  it('rejects too short', () => {
    expect(sanitizePhone('123')).toBeNull();
    expect(sanitizePhone('123456')).toBeNull();
  });
  it('returns null for empty/null/undefined', () => {
    expect(sanitizePhone('')).toBeNull();
    expect(sanitizePhone(null)).toBeNull();
  });
});

describe('sanitizeForScriptInjection', () => {
  it('removes </script> to avoid breaking out of script tags', () => {
    expect(sanitizeForScriptInjection('hello </script> world')).toBe('hello  world');
    expect(sanitizeForScriptInjection('</SCRIPT>')).toBe('');
  });
  it('replaces newlines with space', () => {
    expect(sanitizeForScriptInjection('a\nb')).toBe('a b');
  });
  it('truncates to 2000 chars', () => {
    const long = 'x'.repeat(3000);
    expect(sanitizeForScriptInjection(long).length).toBe(2000);
  });
  it('returns empty for null/undefined', () => {
    expect(sanitizeForScriptInjection(null)).toBe('');
    expect(sanitizeForScriptInjection(undefined)).toBe('');
  });
});
