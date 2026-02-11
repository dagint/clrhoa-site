/**
 * Email Validation Utilities
 *
 * Provides robust email validation following RFC 5322 guidelines
 * with practical restrictions for security and usability.
 *
 * Security considerations:
 * - Prevents common injection attacks
 * - Blocks suspicious patterns
 * - Enforces reasonable length limits
 * - Validates TLD requirements
 *
 * Usage:
 * ```typescript
 * import { isValidEmail, normalizeEmail } from './email-validation';
 *
 * if (!isValidEmail('user@example.com')) {
 *   return 'Invalid email';
 * }
 *
 * const normalized = normalizeEmail('User@Example.COM');
 * // Returns: 'user@example.com'
 * ```
 */

/**
 * Email validation regex
 *
 * This regex follows RFC 5322 with practical restrictions:
 * - Local part: alphanumeric, dots, hyphens, underscores, plus signs
 * - Domain: alphanumeric, dots, hyphens
 * - TLD: at least 2 characters (rejects single-char TLDs)
 * - No consecutive dots
 * - No dots at start/end
 *
 * This is intentionally stricter than RFC 5322 to prevent common issues.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]*[a-zA-Z0-9]@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Maximum email length (RFC 5321 limit is 320 characters)
 */
const MAX_EMAIL_LENGTH = 320;

/**
 * Minimum email length (a@b.co = 6 characters)
 */
const MIN_EMAIL_LENGTH = 6;

/**
 * Suspicious patterns that might indicate injection attempts
 */
const SUSPICIOUS_PATTERNS = [
  /\.\./,           // Consecutive dots
  /^[.-]/,          // Starts with dot or hyphen
  /[.-]@/,          // Dot or hyphen before @
  /@[.-]/,          // Dot or hyphen after @
  /[.-]$/,          // Ends with dot or hyphen
  /[@]{2,}/,        // Multiple @ signs
  /[\s]/,           // Whitespace
  /[<>]/,           // Angle brackets (potential injection)
  /['";]/,          // Quotes/semicolons (potential injection)
  /[()]/,           // Parentheses (uncommon in emails)
];

/**
 * Validate email address with comprehensive checks
 *
 * @param email - Email address to validate
 * @returns True if email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  // Check basic requirements
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmed = email.trim();

  // Check length
  if (trimmed.length < MIN_EMAIL_LENGTH || trimmed.length > MAX_EMAIL_LENGTH) {
    return false;
  }

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  // Check basic format
  if (!EMAIL_REGEX.test(trimmed)) {
    return false;
  }

  // Additional validation: check parts
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domainPart] = parts;

  // Validate local part (before @)
  if (!localPart || localPart.length > 64) {
    return false; // RFC 5321: local part max 64 characters
  }

  // Validate domain part (after @)
  if (!domainPart || domainPart.length > 253) {
    return false; // RFC 5321: domain max 253 characters
  }

  // Domain must have at least one dot
  if (!domainPart.includes('.')) {
    return false;
  }

  // Check TLD (last part of domain)
  const domainParts = domainPart.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || tld.length > 63) {
    return false; // TLD must be 2-63 characters
  }

  // All checks passed
  return true;
}

/**
 * Normalize email address to lowercase and trim whitespace
 *
 * @param email - Email address to normalize
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Extract domain from email address
 *
 * @param email - Email address
 * @returns Domain part (after @) or null if invalid
 */
export function getEmailDomain(email: string): string | null {
  if (!isValidEmail(email)) {
    return null;
  }

  const parts = email.split('@');
  return parts[1] || null;
}

/**
 * Check if email is from a disposable email provider
 * (Basic implementation - can be extended with a larger blocklist)
 *
 * @param email - Email address to check
 * @returns True if email is likely from a disposable provider
 */
export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  // Common disposable email domains
  const disposableDomains = [
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.com',
    'throwaway.email',
    'trashmail.com',
    'yopmail.com',
  ];

  return disposableDomains.includes(domain.toLowerCase());
}

/**
 * Validate and normalize email in one step
 *
 * @param email - Email address to validate and normalize
 * @returns Normalized email if valid, null if invalid
 */
export function validateAndNormalizeEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  return isValidEmail(normalized) ? normalized : null;
}
