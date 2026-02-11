/**
 * Password Storage & Hashing
 *
 * Secure password hashing using bcrypt (industry standard).
 * Supports password verification, history tracking, and hash upgrades.
 *
 * Security Features:
 * - bcrypt hashing (cost factor 10-12)
 * - Automatic salt generation
 * - Password history tracking (prevent reuse)
 * - Hash version tracking (for future upgrades)
 * - Constant-time comparison
 *
 * Usage:
 * ```typescript
 * import { hashPassword, verifyPassword, checkPasswordHistory } from './password';
 *
 * // Hash a new password
 * const hash = await hashPassword('MySecureP@ssw0rd');
 *
 * // Verify password
 * const isValid = await verifyPassword('MySecureP@ssw0rd', hash);
 *
 * // Check against password history
 * const reused = await checkPasswordHistory(db, userEmail, 'OldP@ssw0rd');
 * if (reused) {
 *   return { error: 'Cannot reuse recent passwords' };
 * }
 * ```
 */

/// <reference types="@cloudflare/workers-types" />

/**
 * bcrypt configuration
 */
const BCRYPT_COST_FACTOR = 10; // 2^10 iterations (recommended: 10-12)
const PASSWORD_HISTORY_LIMIT = 5; // Track last 5 passwords

/**
 * Hash a password using bcrypt.
 *
 * @param password - Plain text password
 * @returns bcrypt hash (includes salt and cost factor)
 */
export async function hashPassword(password: string): Promise<string> {
  // Use bcryptjs for Cloudflare Workers compatibility
  // Dynamic import to avoid issues with bundling
  const bcrypt = await import('bcryptjs');

  const salt = await bcrypt.genSalt(BCRYPT_COST_FACTOR);
  const hash = await bcrypt.hash(password, salt);

  return hash;
}

/**
 * Verify a password against a bcrypt hash.
 *
 * @param password - Plain text password to verify
 * @param hash - bcrypt hash to compare against
 * @returns True if password matches hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('[password] Failed to verify password:', error);
    return false;
  }
}

/**
 * Check if a password was used recently (password history).
 *
 * @param db - D1 database instance
 * @param userEmail - User email
 * @param password - Password to check
 * @returns True if password was used recently
 */
export async function checkPasswordHistory(
  db: D1Database | undefined,
  userEmail: string,
  password: string
): Promise<boolean> {
  if (!db) {
    return false;
  }

  try {
    // Get user's password history
    const user = await db
      .prepare('SELECT password_hash, previous_password_hashes FROM users WHERE email = ?')
      .bind(userEmail)
      .first<{ password_hash: string | null; previous_password_hashes: string | null }>();

    if (!user) {
      return false;
    }

    // Check current password
    if (user.password_hash) {
      const matchesCurrent = await verifyPassword(password, user.password_hash);
      if (matchesCurrent) {
        return true;
      }
    }

    // Check password history
    if (user.previous_password_hashes) {
      try {
        const previousHashes = JSON.parse(user.previous_password_hashes) as string[];

        for (const oldHash of previousHashes) {
          const matchesOld = await verifyPassword(password, oldHash);
          if (matchesOld) {
            return true;
          }
        }
      } catch (error) {
        console.error('[password] Failed to parse password history:', error);
      }
    }

    return false;
  } catch (error) {
    console.error('[password] Failed to check password history:', error);
    return false;
  }
}

/**
 * Update user's password and maintain password history.
 *
 * @param db - D1 database instance
 * @param userEmail - User email
 * @param newPassword - New password (plain text)
 * @returns Success boolean
 */
export async function updatePassword(
  db: D1Database | undefined,
  userEmail: string,
  newPassword: string
): Promise<boolean> {
  if (!db) {
    console.warn('[password] No database provided, cannot update password');
    return false;
  }

  try {
    // Get current password hash
    const user = await db
      .prepare('SELECT password_hash, previous_password_hashes FROM users WHERE email = ?')
      .bind(userEmail)
      .first<{ password_hash: string | null; previous_password_hashes: string | null }>();

    if (!user) {
      console.error('[password] User not found:', userEmail);
      return false;
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Update password history
    let previousHashes: string[] = [];

    if (user.previous_password_hashes) {
      try {
        previousHashes = JSON.parse(user.previous_password_hashes) as string[];
      } catch (error) {
        console.error('[password] Failed to parse password history, resetting:', error);
        previousHashes = [];
      }
    }

    // Add current password to history (if it exists)
    if (user.password_hash) {
      previousHashes.unshift(user.password_hash);
    }

    // Keep only last N passwords
    previousHashes = previousHashes.slice(0, PASSWORD_HISTORY_LIMIT);

    // Update database
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             previous_password_hashes = ?,
             password_changed_at = ?,
             updated_at = ?
         WHERE email = ?`
      )
      .bind(
        newHash,
        JSON.stringify(previousHashes),
        now,
        now,
        userEmail
      )
      .run();

    return true;
  } catch (error) {
    console.error('[password] Failed to update password:', error);
    return false;
  }
}

/**
 * Check if a password hash needs to be upgraded.
 *
 * bcrypt hashes include the cost factor, so we can detect if an old
 * hash was created with a lower cost factor and needs upgrading.
 *
 * @param hash - bcrypt hash to check
 * @returns True if hash should be upgraded
 */
export async function needsRehash(hash: string): Promise<boolean> {
  try {
    const bcrypt = await import('bcryptjs');

    // Extract cost factor from hash
    // bcrypt format: $2a$10$... (10 is the cost factor)
    const parts = hash.split('$');
    if (parts.length < 4) {
      return true; // Invalid hash format, should rehash
    }

    const currentCost = parseInt(parts[2], 10);
    return currentCost < BCRYPT_COST_FACTOR;
  } catch (error) {
    console.error('[password] Failed to check if rehash needed:', error);
    return false;
  }
}

/**
 * Rehash a password if the current hash uses an outdated cost factor.
 *
 * This should be called after successful login to upgrade old hashes.
 *
 * @param db - D1 database instance
 * @param userEmail - User email
 * @param password - User's plain text password (just verified)
 * @param currentHash - Current password hash
 * @returns True if rehash was performed
 */
export async function rehashIfNeeded(
  db: D1Database | undefined,
  userEmail: string,
  password: string,
  currentHash: string
): Promise<boolean> {
  if (!db) {
    return false;
  }

  try {
    const shouldRehash = await needsRehash(currentHash);

    if (shouldRehash) {
      console.log('[password] Upgrading password hash for user:', userEmail);
      const newHash = await hashPassword(password);

      await db
        .prepare(
          `UPDATE users
           SET password_hash = ?,
               updated_at = ?
           WHERE email = ?`
        )
        .bind(newHash, new Date().toISOString(), userEmail)
        .run();

      return true;
    }

    return false;
  } catch (error) {
    console.error('[password] Failed to rehash password:', error);
    return false;
  }
}

/**
 * Generate a cryptographically secure random integer in range [0, max).
 *
 * @param max - Upper bound (exclusive)
 * @returns Random integer
 */
function getSecureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

/**
 * Generate a temporary password for new user setup.
 *
 * Format: [Word]-[Word]-[4 digits]-[Symbol]
 * Example: "Cloud-Horse-8472-!"
 *
 * This is a fallback if email delivery fails. Users should be prompted
 * to change this immediately.
 *
 * @returns Temporary password
 */
export async function generateTemporaryPassword(): Promise<string> {
  const words = [
    'Cloud', 'River', 'Mountain', 'Ocean', 'Forest', 'Desert', 'Valley', 'Storm',
    'Thunder', 'Lightning', 'Sunrise', 'Sunset', 'Meadow', 'Prairie', 'Canyon',
    'Eagle', 'Falcon', 'Hawk', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Panther',
    'Silver', 'Golden', 'Crystal', 'Diamond', 'Emerald', 'Sapphire', 'Ruby',
  ];

  const symbols = ['!', '@', '#', '$', '%', '&', '*'];

  // Random word 1
  const word1 = words[getSecureRandomInt(words.length)];

  // Random word 2
  const word2 = words[getSecureRandomInt(words.length)];

  // Random 4 digits
  const digits = 1000 + getSecureRandomInt(9000);

  // Random symbol
  const symbol = symbols[getSecureRandomInt(symbols.length)];

  return `${word1}-${word2}-${digits}${symbol}`;
}

/**
 * Clear password history for a user.
 * Useful for admin-initiated password resets or account cleanup.
 *
 * @param db - D1 database instance
 * @param userEmail - User email
 */
export async function clearPasswordHistory(
  db: D1Database | undefined,
  userEmail: string
): Promise<void> {
  if (!db) {
    return;
  }

  try {
    await db
      .prepare(
        `UPDATE users
         SET previous_password_hashes = NULL,
             updated_at = ?
         WHERE email = ?`
      )
      .bind(new Date().toISOString(), userEmail)
      .run();
  } catch (error) {
    console.error('[password] Failed to clear password history:', error);
  }
}
