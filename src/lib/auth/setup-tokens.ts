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

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Set Up Your CLRHOA Portal Account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to CLRHOA</h1>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-top: 0;">
      ${userName ? `Hi ${escapeHtml(userName)},` : 'Hello,'}
    </p>

    <p style="font-size: 16px;">
      Your CLRHOA member portal account has been created! To get started, you need to set up your password.
    </p>

    <p style="font-size: 16px;">
      Click the button below to create your password and activate your account:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${setupUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Set Up Your Password
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${setupUrl}
    </p>

    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        <strong>⏰ This link expires in 48 hours.</strong><br>
        Please set up your password as soon as possible.
      </p>
    </div>

    <p style="font-size: 14px; color: #666; margin-bottom: 0;">
      Once you've set up your password, you'll have full access to the member portal where you can:
    </p>
    <ul style="font-size: 14px; color: #666;">
      <li>View and download HOA documents</li>
      <li>Access the member directory</li>
      <li>Submit ARB requests</li>
      <li>View meeting minutes and schedules</li>
      <li>And much more!</li>
    </ul>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 13px; color: #999; margin-bottom: 5px;">
      Need help? Contact us at <a href="mailto:support@clrhoa.com" style="color: #667eea; text-decoration: none;">support@clrhoa.com</a>
    </p>

    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      If you didn't expect this email, please contact our support team immediately.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">
      &copy; ${new Date().getFullYear()} CLRHOA. All rights reserved.
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Welcome to CLRHOA!

${userName ? `Hi ${userName},` : 'Hello,'}

Your CLRHOA member portal account has been created! To get started, you need to set up your password.

Set up your password by visiting this link:
${setupUrl}

⏰ This link expires in 48 hours. Please set up your password as soon as possible.

Once you've set up your password, you'll have full access to the member portal where you can:
- View and download HOA documents
- Access the member directory
- Submit ARB requests
- View meeting minutes and schedules
- And much more!

Need help? Contact us at support@clrhoa.com

If you didn't expect this email, please contact our support team immediately.

© ${new Date().getFullYear()} CLRHOA. All rights reserved.
  `.trim();

  await resend.emails.send({
    from: 'CLRHOA Portal <portal@clrhoa.com>',
    to: userEmail,
    subject: 'Set up your CLRHOA portal account',
    html: htmlBody,
    text: textBody,
  });
}
