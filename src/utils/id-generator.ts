/**
 * Centralized ID generation utility.
 * Generates cryptographically secure random IDs similar to nanoid.
 */

const ID_LEN = 21; // nanoid-like length
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generate a cryptographically secure random ID.
 * Uses Web Crypto API when available, falls back to Math.random() in older environments.
 *
 * @param length - Optional custom length (default: 21 characters)
 * @returns Random alphanumeric ID string
 *
 * @example
 * const id = generateId(); // "aB3xY9kL2mN4pQ6rS8tU0"
 * const shortId = generateId(10); // "aB3xY9kL2m"
 */
export function generateId(length: number = ID_LEN): string {
  let id = '';
  const bytes = new Uint8Array(length);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      id += CHARS[bytes[i]! % CHARS.length];
    }
  } else {
    // Fallback for environments without Web Crypto API
    for (let i = 0; i < length; i++) {
      id += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
  }

  return id;
}

/**
 * Generate multiple unique IDs at once.
 * More efficient than calling generateId() multiple times.
 *
 * @param count - Number of IDs to generate
 * @param length - Optional custom length per ID (default: 21)
 * @returns Array of unique random IDs
 */
export function generateIds(count: number, length: number = ID_LEN): string[] {
  const ids = new Set<string>();

  while (ids.size < count) {
    ids.add(generateId(length));
  }

  return Array.from(ids);
}
