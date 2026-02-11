import { describe, it, expect } from 'vitest';
import { escapeCsv } from '../../src/lib/csv-utils';

describe('escapeCsv', () => {
  it('returns empty string for null', () => {
    expect(escapeCsv(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCsv(undefined)).toBe('');
  });

  it('returns trimmed value for safe strings', () => {
    expect(escapeCsv('hello')).toBe('hello');
    expect(escapeCsv('  hello  ')).toBe('hello');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(escapeCsv('   ')).toBe('');
  });

  it('wraps in quotes and escapes embedded double quotes', () => {
    expect(escapeCsv('has "quotes"')).toBe('"has ""quotes"""');
  });

  it('wraps in quotes when value contains comma', () => {
    expect(escapeCsv('a, b')).toBe('"a, b"');
  });

  it('wraps in quotes when value contains newline', () => {
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps in quotes when value contains carriage return', () => {
    expect(escapeCsv("line1\rline2")).toBe('"line1\rline2"');
  });

  it('prefixes = with single quote to prevent formula injection', () => {
    expect(escapeCsv('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
  });

  it('prefixes + with single quote to prevent formula injection', () => {
    expect(escapeCsv('+cmd|...')).toBe("'+cmd|...");
  });

  it('prefixes - with single quote to prevent formula injection', () => {
    expect(escapeCsv('-1+1')).toBe("'-1+1");
  });

  it('prefixes @ with single quote to prevent formula injection', () => {
    expect(escapeCsv('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('trims leading/trailing tab characters', () => {
    // Leading tab is trimmed by String.trim(), neutralizing the injection vector
    expect(escapeCsv('\tcmd')).toBe('cmd');
    // Tab in the middle passes through (not a CSV injection vector)
    expect(escapeCsv('a\tcmd')).toBe('a\tcmd');
  });

  it('handles formula chars that also need quoting (comma)', () => {
    const result = escapeCsv('=1,2');
    expect(result.startsWith('"')).toBe(true);
    expect(result).toBe("\"'=1,2\"");
  });

  it('passes through normal numbers', () => {
    expect(escapeCsv('42')).toBe('42');
  });

  it('passes through email addresses (@ not at start)', () => {
    // @ in the middle of an email is not a CSV injection vector
    expect(escapeCsv('user@example.com')).toBe('user@example.com');
  });

  it('prefixes @ when at start of value', () => {
    expect(escapeCsv('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});
