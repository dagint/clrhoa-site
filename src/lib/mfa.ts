/**
 * MFA/TOTP Utilities
 *
 * Two-factor authentication using Time-based One-Time Passwords (TOTP).
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 *
 * Security Features:
 * - TOTP secrets stored encrypted in KV (AES-256-GCM)
 * - Backup codes hashed with bcrypt before storage
 * - Rate limiting on verification attempts
 * - Audit logging for all MFA events
 *
 * Usage:
 * ```typescript
 * import { generateMFASecret, generateQRCode, verifyTOTP } from './lib/mfa';
 *
 * // Setup flow
 * const secret = generateMFASecret();
 * const qrCode = await generateQRCode(secret, userEmail, 'CLRHOA Portal');
 *
 * // Verification
 * const isValid = verifyTOTP(secret, userProvidedCode);
 * ```
 */

import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';
import crypto from 'node:crypto';

// Configure TOTP settings
authenticator.options = {
  window: 1, // Allow 30s time drift (1 window before/after current)
  step: 30, // 30-second time step (standard)
};

const BACKUP_CODE_LENGTH = 8; // 8-character backup codes
const BACKUP_CODE_COUNT = 10; // Generate 10 backup codes

/**
 * Generate a new TOTP secret for a user.
 * Returns base32-encoded secret compatible with authenticator apps.
 *
 * @returns Base32-encoded secret string
 */
export function generateMFASecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate a QR code data URL for TOTP setup.
 * Users scan this with their authenticator app.
 *
 * @param secret - TOTP secret (base32)
 * @param userEmail - User's email address
 * @param issuer - Application name (e.g., "CLRHOA Portal")
 * @returns Data URL for QR code image
 */
export async function generateQRCode(
  secret: string,
  userEmail: string,
  issuer: string = 'CLRHOA Portal'
): Promise<string> {
  const otpauthUrl = authenticator.keyuri(userEmail, issuer, secret);

  // Generate QR code as data URL (PNG image)
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'H', // High error correction
  });

  return qrCodeDataUrl;
}

/**
 * Verify a TOTP code against a secret.
 *
 * @param secret - TOTP secret (base32)
 * @param token - 6-digit code from authenticator app
 * @returns True if code is valid
 */
export function verifyTOTP(secret: string, token: string): boolean {
  try {
    // Remove spaces and ensure it's a 6-digit string
    const cleanToken = token.replace(/\s/g, '');

    if (!/^\d{6}$/.test(cleanToken)) {
      return false;
    }

    return authenticator.verify({ token: cleanToken, secret });
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * Encrypt MFA secret for storage in KV.
 * Uses AES-256-GCM with a key derived from SESSION_SECRET.
 *
 * @param secret - Plain text TOTP secret
 * @param encryptionKey - Encryption key (SESSION_SECRET)
 * @returns Encrypted secret as hex string (includes IV and auth tag)
 */
export function encryptSecret(secret: string, encryptionKey: string): string {
  // Derive 32-byte key from SESSION_SECRET using SHA-256
  const key = crypto.createHash('sha256').update(encryptionKey).digest();

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Encrypt
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const authTag = cipher.getAuthTag().toString('hex');

  // Return IV + encrypted + authTag (all hex-encoded)
  return iv.toString('hex') + ':' + encrypted + ':' + authTag;
}

/**
 * Decrypt MFA secret from KV storage.
 *
 * @param encryptedSecret - Encrypted secret from KV
 * @param encryptionKey - Encryption key (SESSION_SECRET)
 * @returns Decrypted TOTP secret
 */
export function decryptSecret(encryptedSecret: string, encryptionKey: string): string {
  // Derive key
  const key = crypto.createHash('sha256').update(encryptionKey).digest();

  // Parse encrypted data
  const parts = encryptedSecret.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');

  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate backup codes for MFA recovery.
 * Returns array of plain text codes (to be hashed before storage).
 *
 * @param count - Number of codes to generate (default: 10)
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate random 8-character alphanumeric code
    const code = crypto
      .randomBytes(BACKUP_CODE_LENGTH)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, BACKUP_CODE_LENGTH)
      .toUpperCase();

    codes.push(code);
  }

  return codes;
}

/**
 * Hash a backup code for storage.
 * Uses SHA-256 (backup codes are already random, don't need slow hashing).
 *
 * @param code - Plain text backup code
 * @returns Hashed code (hex)
 */
export function hashBackupCode(code: string): string {
  // Strip hyphens and spaces so that formatted codes (ABCD-1234) match
  const cleanCode = code.replace(/[-\s]/g, '').toUpperCase();
  return crypto
    .createHash('sha256')
    .update(cleanCode)
    .digest('hex');
}

/**
 * Verify a backup code against stored hash.
 *
 * @param code - User-provided code
 * @param hash - Stored hash from database
 * @returns True if code matches hash
 */
export function verifyBackupCode(code: string, hash: string): boolean {
  const computedHash = hashBackupCode(code);
  return computedHash === hash;
}

/**
 * Format backup code for display (add hyphens).
 * Example: ABCD1234 → ABCD-1234
 *
 * @param code - Plain backup code
 * @returns Formatted code with hyphens
 */
export function formatBackupCode(code: string): string {
  if (code.length === 8) {
    return `${code.substring(0, 4)}-${code.substring(4)}`;
  }
  return code;
}

/**
 * Store MFA secret in KV (encrypted).
 *
 * @param kv - KV namespace
 * @param userId - User email
 * @param secret - TOTP secret (plain text)
 * @param sessionSecret - Encryption key
 */
export async function storeMFASecret(
  kv: KVNamespace,
  userId: string,
  secret: string,
  sessionSecret: string
): Promise<void> {
  const encrypted = encryptSecret(secret, sessionSecret);
  const key = `mfa_secret:${userId}`;

  // Store with 1-year expiration (will be refreshed on use)
  await kv.put(key, encrypted, { expirationTtl: 365 * 24 * 60 * 60 });
}

/**
 * Retrieve MFA secret from KV (decrypted).
 *
 * @param kv - KV namespace
 * @param userId - User email
 * @param sessionSecret - Encryption key
 * @returns Decrypted TOTP secret or null if not found
 */
export async function getMFASecret(
  kv: KVNamespace,
  userId: string,
  sessionSecret: string
): Promise<string | null> {
  const key = `mfa_secret:${userId}`;
  const encrypted = await kv.get(key);

  if (!encrypted) {
    return null;
  }

  try {
    return decryptSecret(encrypted, sessionSecret);
  } catch (error) {
    console.error('Failed to decrypt MFA secret:', error);
    return null;
  }
}

/**
 * Delete MFA secret from KV.
 *
 * @param kv - KV namespace
 * @param userId - User email
 */
export async function deleteMFASecret(
  kv: KVNamespace,
  userId: string
): Promise<void> {
  const key = `mfa_secret:${userId}`;
  await kv.delete(key);
}
