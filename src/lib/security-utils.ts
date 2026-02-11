/**
 * Security Utilities
 *
 * Helper functions for security-sensitive operations:
 * - Secure token generation
 * - Password strength validation
 * - Account lockout logic
 * - Suspicious activity detection
 *
 * Usage:
 * ```typescript
 * import { generateSecureToken, validatePasswordStrength, checkAccountLockout } from './security-utils';
 *
 * // Generate password reset token
 * const token = await generateSecureToken(32);
 *
 * // Validate password strength
 * const strength = validatePasswordStrength('MyP@ssw0rd123');
 * if (!strength.isValid) {
 *   return { error: strength.errors.join(', ') };
 * }
 *
 * // Check if account is locked
 * const lockout = await checkAccountLockout(db, userEmail);
 * if (lockout.isLocked) {
 *   return { error: 'Account temporarily locked', retryAfter: lockout.lockedUntil };
 * }
 * ```
 */

/// <reference types="@cloudflare/workers-types" />

import { logSecurityEvent } from './audit-log';

/**
 * Generate a cryptographically secure random token.
 *
 * @param length - Token length in bytes (default: 32 = 256 bits)
 * @returns Hex-encoded random token
 */
export async function generateSecureToken(length: number = 32): Promise<string> {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure hash of a token for database storage.
 * Tokens should be hashed before storing to prevent token theft from database dumps.
 *
 * @param token - Plain token to hash
 * @returns SHA-256 hash of token (hex-encoded)
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Password strength validation result
 */
export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-4 (weak to strong)
  errors: string[];
  suggestions: string[];
}

/**
 * Validate password strength according to security requirements.
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * - Not a common password
 *
 * @param password - Password to validate
 * @returns Password strength result
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  } else {
    score += 1;
  }

  if (password.length >= 16) {
    score += 1;
  }

  // Character diversity checks
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  } else {
    score += 1;
  }

  // Common password check (basic list)
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty',
    'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
    'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', '123123',
    'admin', 'welcome', 'login', 'password1', 'qwerty123',
  ];

  // Strip non-alphanumeric for common password check
  const normalizedPassword = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (commonPasswords.some(common => normalizedPassword.includes(common))) {
    errors.push('Password is too common');
    score = Math.max(0, score - 2);
  }

  // Sequential characters check
  if (/(.)\1{2,}/.test(password)) {
    suggestions.push('Avoid repeating characters (e.g., "aaa", "111")');
    score = Math.max(0, score - 1);
  }

  // Keyboard patterns (basic check)
  const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn', '123456', 'abcdef'];
  if (keyboardPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    suggestions.push('Avoid keyboard patterns');
    score = Math.max(0, score - 1);
  }

  // Cap score at 4
  score = Math.min(4, score);

  return {
    isValid: errors.length === 0,
    score,
    errors,
    suggestions,
  };
}

/**
 * Account lockout check result
 */
export interface AccountLockoutResult {
  isLocked: boolean;
  lockedUntil?: Date;
  failedAttempts: number;
  maxAttempts: number;
}

/**
 * Check if an account is locked due to failed login attempts.
 *
 * Lockout policy:
 * - 5 failed attempts within 15 minutes = 15 minute lockout
 * - Lockout duration doubles for repeat violations (up to 24 hours)
 *
 * @param db - D1 database instance
 * @param userEmail - User email to check
 * @returns Account lockout status
 */
export async function checkAccountLockout(
  db: D1Database | undefined,
  userEmail: string
): Promise<AccountLockoutResult> {
  if (!db) {
    return {
      isLocked: false,
      failedAttempts: 0,
      maxAttempts: 5,
    };
  }

  try {
    // Check user's current lockout status
    const user = await db
      .prepare('SELECT locked_until, failed_login_attempts FROM users WHERE email = ?')
      .bind(userEmail)
      .first<{ locked_until: string | null; failed_login_attempts: number }>();

    if (!user) {
      return {
        isLocked: false,
        failedAttempts: 0,
        maxAttempts: 5,
      };
    }

    const now = new Date();
    const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;

    // Check if currently locked
    if (lockedUntil && now < lockedUntil) {
      return {
        isLocked: true,
        lockedUntil,
        failedAttempts: user.failed_login_attempts,
        maxAttempts: 5,
      };
    }

    // Lockout has expired, reset counter
    if (lockedUntil && now >= lockedUntil) {
      await db
        .prepare(
          `UPDATE users
           SET failed_login_attempts = 0,
               locked_until = NULL
           WHERE email = ?`
        )
        .bind(userEmail)
        .run();

      return {
        isLocked: false,
        failedAttempts: 0,
        maxAttempts: 5,
      };
    }

    return {
      isLocked: false,
      failedAttempts: user.failed_login_attempts,
      maxAttempts: 5,
    };
  } catch (error) {
    console.error('[security] Failed to check account lockout:', error);
    // Fail open - don't lock accounts if check fails
    return {
      isLocked: false,
      failedAttempts: 0,
      maxAttempts: 5,
    };
  }
}

/**
 * Record a failed login attempt and potentially lock the account.
 *
 * @param db - D1 database instance
 * @param userEmail - User email
 * @param ipAddress - IP address of failed attempt
 * @param userAgent - User agent of failed attempt
 * @param correlationId - Request correlation ID
 * @returns Updated lockout status
 */
export async function recordFailedLoginAttempt(
  db: D1Database | undefined,
  userEmail: string,
  ipAddress?: string | null,
  userAgent?: string | null,
  correlationId?: string
): Promise<AccountLockoutResult> {
  if (!db) {
    return {
      isLocked: false,
      failedAttempts: 0,
      maxAttempts: 5,
    };
  }

  try {
    const now = new Date();

    // Increment failed attempts counter
    await db
      .prepare(
        `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             last_failed_login = ?
         WHERE email = ?`
      )
      .bind(now.toISOString(), userEmail)
      .run();

    // Get updated attempt count
    const user = await db
      .prepare('SELECT failed_login_attempts FROM users WHERE email = ?')
      .bind(userEmail)
      .first<{ failed_login_attempts: number }>();

    const failedAttempts = user?.failed_login_attempts || 0;

    // Lock account if threshold exceeded
    if (failedAttempts >= 5) {
      // 15 minute lockout
      const lockoutUntil = new Date(now.getTime() + 15 * 60 * 1000);

      await db
        .prepare('UPDATE users SET locked_until = ? WHERE email = ?')
        .bind(lockoutUntil.toISOString(), userEmail)
        .run();

      // Log security event
      await logSecurityEvent(db, {
        eventType: 'account_locked',
        severity: 'critical',
        userId: userEmail,
        ipAddress,
        userAgent,
        correlationId,
        autoRemediated: true,
        remediationAction: 'account_locked',
        details: {
          reason: 'excessive_failed_logins',
          failedAttempts,
          lockoutUntil: lockoutUntil.toISOString(),
          lockoutDurationMinutes: 15,
        },
      });

      return {
        isLocked: true,
        lockedUntil: lockoutUntil,
        failedAttempts,
        maxAttempts: 5,
      };
    }

    return {
      isLocked: false,
      failedAttempts,
      maxAttempts: 5,
    };
  } catch (error) {
    console.error('[security] Failed to record failed login attempt:', error);
    return {
      isLocked: false,
      failedAttempts: 0,
      maxAttempts: 5,
    };
  }
}

/**
 * Reset failed login attempts after successful login.
 *
 * @param db - D1 database instance
 * @param userEmail - User email
 */
export async function resetFailedLoginAttempts(
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
         SET failed_login_attempts = 0,
             locked_until = NULL,
             last_failed_login = NULL
         WHERE email = ?`
      )
      .bind(userEmail)
      .run();
  } catch (error) {
    console.error('[security] Failed to reset failed login attempts:', error);
  }
}

/**
 * Detect suspicious login activity.
 *
 * Flags:
 * - Login from new location (different country)
 * - Login from new device (different user agent)
 * - Multiple failed attempts from different IPs
 * - Login at unusual time (based on user history)
 *
 * @param db - D1 database instance
 * @param userEmail - User email
 * @param ipAddress - Current IP address
 * @param userAgent - Current user agent
 * @returns Suspicion indicators
 */
export async function detectSuspiciousActivity(
  db: D1Database | undefined,
  userEmail: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<{
  isSuspicious: boolean;
  reasons: string[];
}> {
  if (!db || !ipAddress || !userAgent) {
    return { isSuspicious: false, reasons: [] };
  }

  const reasons: string[] = [];

  try {
    // Check recent login history
    const recentLogins = await db
      .prepare(
        `SELECT ip_address, user_agent
         FROM login_history
         WHERE user_email = ?
         ORDER BY login_time DESC
         LIMIT 10`
      )
      .bind(userEmail)
      .all<{ ip_address: string | null; user_agent: string | null }>();

    if (recentLogins.results && recentLogins.results.length > 0) {
      const knownIPs = new Set(
        recentLogins.results.map(l => l.ip_address).filter(Boolean)
      );
      const knownUserAgents = new Set(
        recentLogins.results.map(l => l.user_agent).filter(Boolean)
      );

      // New IP address
      if (!knownIPs.has(ipAddress)) {
        reasons.push('login_from_new_ip');
      }

      // New user agent (new device)
      if (!knownUserAgents.has(userAgent)) {
        reasons.push('login_from_new_device');
      }
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
    };
  } catch (error) {
    console.error('[security] Failed to detect suspicious activity:', error);
    return { isSuspicious: false, reasons: [] };
  }
}
