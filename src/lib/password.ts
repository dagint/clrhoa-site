/**
 * Password Hashing Utilities
 *
 * Secure password hashing using bcrypt with appropriate cost factor.
 *
 * Security:
 * - Cost factor 10 (balances security and performance)
 * - Passwords are never stored in plain text
 * - Timing-safe comparison prevents timing attacks
 *
 * Usage:
 * ```typescript
 * import { hashPassword, verifyPassword } from './password';
 *
 * // Hash a password
 * const hash = await hashPassword('user-password-123');
 *
 * // Verify a password
 * const isValid = await verifyPassword('user-password-123', hash);
 * ```
 */

import bcrypt from 'bcryptjs';
import { logger } from './logger';

/**
 * Cost factor for bcrypt hashing.
 * Higher values = more secure but slower.
 * 10 is recommended for web applications (balances security and UX).
 */
const BCRYPT_COST_FACTOR = 10;

/**
 * Hash a password using bcrypt.
 *
 * @param password - Plain text password to hash
 * @returns Promise resolving to bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

/**
 * Verify a password against a bcrypt hash.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    // If hash is invalid or comparison fails, return false
    logger.error('Password verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Check if a hash needs to be rehashed (cost factor changed).
 * Useful for gradually upgrading password security over time.
 *
 * @param hash - Bcrypt hash to check
 * @returns True if hash should be regenerated with new cost factor
 */
export function needsRehash(hash: string): boolean {
  try {
    const rounds = bcrypt.getRounds(hash);
    return rounds !== BCRYPT_COST_FACTOR;
  } catch {
    // If hash is invalid, it definitely needs rehashing
    return true;
  }
}
