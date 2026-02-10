/**
 * Shared CSV utilities for export endpoints.
 */

/** Characters that can trigger formula execution in spreadsheet applications. */
const CSV_INJECTION_CHARS = '=+-@\t\r';

/**
 * Escape a value for safe inclusion in a CSV cell.
 * - Prevents CSV injection by prefixing formula-triggering characters with a single quote.
 * - Wraps values containing quotes, commas, or newlines in double quotes.
 */
export function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  let s = String(value).trim();
  if (s.length > 0 && CSV_INJECTION_CHARS.includes(s[0])) {
    s = "'" + s;
  }
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
