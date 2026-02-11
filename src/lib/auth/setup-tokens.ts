/**
 * Password Setup Token Generation
 *
 * Utilities for creating and sending password setup tokens for new users.
 * Used by admin/board when creating new user accounts.
 *
 * Security:
 * - Tokens are cryptographically random (32 bytes)
 * - Tokens are hashed (SHA-256) before storage
 * - Tokens expire after 48 hours
 * - Tokens are single-use only
 * - Rate limiting prevents spam
 *
 * Usage:
 * ```typescript
 * import { generateSetupToken, sendSetupEmail } from './setup-tokens';
 *
 * // Generate token and store in database
 * const { token, tokenHash, expiresAt } = await generateSetupToken(db, userEmail, sentByEmail);
 *
 * // Send setup email to user
 * await sendSetupEmail(resend, userEmail, token, userName);
 * ```
 */

import crypto from 'node:crypto';
import { logSecurityEvent } from '../audit-log';
import { escapeHtml } from '../sanitize';
import { createEmailTemplate, p, ul } from '../email/templates';

const TOKEN_EXPIRATION_HOURS = 48;
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
 * Generate a password setup token and store in database.
 *
 * @param db - D1 database instance
 * @param userId - User email (who will use the token)
 * @param sentBy - Email of admin/board who created the token
 * @returns Object with token (plain text), tokenHash, and expiresAt
 */
export async function generateSetupToken(
  db: D1Database,
  userId: string,
  sentBy?: string
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

  // Calculate expiration (48 hours from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRATION_HOURS);

  // Store hashed token in database
  // Check if sent_count and sent_by columns exist (newer schema)
  // If not, fall back to created_by (older schema)
  try {
    await db
      .prepare(
        `INSERT INTO password_setup_tokens (
          id,
          user_id,
          token_hash,
          expires_at,
          sent_count,
          sent_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(
        tokenId,
        userId,
        tokenHash,
        expiresAt.toISOString(),
        1, // First send
        sentBy || null
      )
      .run();
  } catch (error) {
    // Fallback for older schema without sent_count/sent_by
    await db
      .prepare(
        `INSERT INTO password_setup_tokens (
          id,
          user_id,
          token_hash,
          expires_at,
          created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(
        tokenId,
        userId,
        tokenHash,
        expiresAt.toISOString(),
        sentBy || null
      )
      .run();
  }

  // Log token generation
  await logSecurityEvent(db, {
    eventType: 'password_setup_token_generated',
    severity: 'info',
    userId,
    details: {
      token_id: tokenId,
      sent_by: sentBy,
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
 * Resend a password setup email (increments sent_count).
 *
 * @param db - D1 database instance
 * @param userId - User email
 * @param resentBy - Email of admin/board who resent the email
 * @returns Object with new token and metadata
 */
export async function resendSetupToken(
  db: D1Database,
  userId: string,
  resentBy: string
): Promise<{
  token: string;
  tokenHash: string;
  tokenId: string;
  expiresAt: string;
}> {
  // Invalidate any existing unused tokens for this user
  await db
    .prepare(
      `UPDATE password_setup_tokens
       SET used = 1,
           used_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND used = 0`
    )
    .bind(userId)
    .run();

  // Generate new token
  const result = await generateSetupToken(db, userId, resentBy);

  // Log resend action
  await logSecurityEvent(db, {
    eventType: 'password_setup_token_resent',
    severity: 'info',
    userId,
    details: {
      token_id: result.tokenId,
      resent_by: resentBy,
    },
  });

  return result;
}

/**
 * Send password setup email using Resend.
 *
 * @param resend - Resend client instance
 * @param userEmail - Recipient email
 * @param token - Plain text token (NOT hashed)
 * @param userName - User's name for personalization
 * @param siteUrl - Base URL of the site
 */
export async function sendSetupEmail(
  resend: any, // Resend client type
  userEmail: string,
  token: string,
  userName?: string,
  siteUrl: string = 'https://www.clrhoa.com'
): Promise<void> {
  const setupUrl = `${siteUrl}/auth/setup-password?token=${token}`;

  // Build email content using template helpers
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hello,';

  const content =
    p(greeting) +
    p('Your CLRHOA member portal account has been created! To get started, you need to set up your password.') +
    p('Click the button below to create your password and activate your account:');

  const portalFeatures = [
    'View and download HOA documents',
    'Access the member directory',
    'Submit ARB requests',
    'View meeting minutes and schedules',
    'And much more!',
  ];

  const featuresContent =
    p('Once you\'ve set up your password, you\'ll have full access to the member portal where you can:') +
    ul(portalFeatures);

  // Create email using branded template
  const { html, text } = createEmailTemplate({
    title: 'Set Up Your CLRHOA Portal Account',
    preheader: 'Create your password and activate your account',
    heading: 'Welcome to CLRHOA',
    content: content + featuresContent,
    ctaText: 'Set Up Your Password',
    ctaUrl: setupUrl,
    alertContent: '<strong>This link expires in 48 hours.</strong><br>Please set up your password as soon as possible.',
    alertType: 'warning',
    footerText: 'If you didn\'t expect this email, please contact our support team immediately.',
  });

  await resend.emails.send({
    from: 'CLRHOA Portal <portal@clrhoa.com>',
    to: userEmail,
    subject: 'Set up your CLRHOA portal account',
    html,
    text,
  });
}
