/**
 * Password Reset Token Generation
 *
 * Utilities for creating and sending password reset tokens.
 * Used in the self-service "forgot password" flow.
 *
 * Security:
 * - Tokens are cryptographically random (32 bytes)
 * - Tokens are hashed (SHA-256) before storage
 * - Tokens expire after 2 hours (shorter than setup tokens)
 * - Tokens are single-use only
 * - Rate limiting prevents spam (3 requests per hour per email)
 *
 * Usage:
 * ```typescript
 * import { generateResetToken, sendResetEmail } from './reset-tokens';
 *
 * // Generate token and store in database
 * const { token, tokenHash, expiresAt } = await generateResetToken(db, userEmail, ipAddress, userAgent);
 *
 * // Send reset email to user
 * await sendResetEmail(resend, userEmail, token, userName);
 * ```
 */

import crypto from 'node:crypto';
import { logSecurityEvent } from '../audit-log';
import { createEmailTemplate, p } from '../email/templates';
import { escapeHtml } from '../sanitize';
import type { ResendClient } from '../../types/resend';

const TOKEN_EXPIRATION_HOURS = 2; // Reset tokens expire faster than setup tokens
const TOKEN_BYTES = 32; // 256 bits

/**
 * Generate a cryptographically secure random token.
 *
 * @returns Base64URL-encoded token string (URL-safe)
 */
function generateRandomToken(): string {
  return crypto
    .randomBytes(TOKEN_BYTES)
    .toString('base64url');
}

/**
 * Hash a token using SHA-256 for database storage.
 *
 * @param token - Plain text token
 * @returns Hexadecimal hash string
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a password reset token and store in database.
 *
 * @param db - D1 database instance
 * @param userId - User email (who will use the token)
 * @param ipAddress - IP address that requested the reset
 * @param userAgent - User agent string
 * @returns Object with token (plain text), tokenHash, tokenId, and expiresAt
 */
export async function generateResetToken(
  db: D1Database,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  token: string;
  tokenHash: string;
  tokenId: string;
  expiresAt: string;
}> {
  // Generate random token
  const token = generateRandomToken();
  const tokenHash = hashToken(token);
  const tokenId = crypto.randomUUID();

  // Calculate expiration (2 hours from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRATION_HOURS);

  // Store hashed token in database
  await db
    .prepare(
      `INSERT INTO password_reset_tokens (
        id,
        user_id,
        token_hash,
        expires_at,
        ip_address,
        user_agent,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(
      tokenId,
      userId,
      tokenHash,
      expiresAt.toISOString(),
      ipAddress || null,
      userAgent || null
    )
    .run();

  // Log token generation
  await logSecurityEvent(db, {
    eventType: 'password_reset_token_generated',
    severity: 'info',
    userId,
    details: {
      token_id: tokenId,
      ip_address: ipAddress,
      expires_at: expiresAt.toISOString(),
    },
  });

  return {
    token,
    tokenHash,
    tokenId,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Send password reset email using Resend.
 *
 * @param resend - Resend client instance
 * @param userEmail - Recipient email
 * @param token - Plain text token (NOT hashed)
 * @param userName - User's name for personalization
 * @param siteUrl - Base URL of the site
 */
export async function sendResetEmail(
  resend: ResendClient,
  userEmail: string,
  token: string,
  userName?: string,
  siteUrl: string = 'https://www.clrhoa.com'
): Promise<void> {
  const resetUrl = `${siteUrl}/auth/reset-password?token=${token}`;

  // Build email content using template helpers
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hello,';

  const content =
    p(greeting) +
    p('We received a request to reset your CLRHOA portal password. If you didn\'t make this request, you can safely ignore this email.') +
    p('To reset your password, click the button below:');

  const securityWarning =
    '<strong>⚠️ Didn\'t request a password reset?</strong><br>' +
    'If you didn\'t request this, please ignore this email. Your password will not be changed. ' +
    'If you\'re concerned about your account security, contact us immediately.';

  // Create email using branded template
  const { html, text } = createEmailTemplate({
    title: 'Reset Your Password',
    preheader: 'Reset your CLRHOA portal password',
    heading: 'Reset Your Password',
    content: content + p(securityWarning, { color: '#721c24' }),
    ctaText: 'Reset Password',
    ctaUrl: resetUrl,
    alertContent: '<strong>This link expires in 2 hours.</strong><br>For your security, this reset link can only be used once.',
    alertType: 'warning',
    footerText: '',
  });

  await resend.emails.send({
    from: 'CLRHOA Portal <portal@clrhoa.com>',
    to: userEmail,
    subject: 'Reset your CLRHOA password',
    html,
    text,
  });
}
