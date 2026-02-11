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
  resend: any, // Resend client type
  userEmail: string,
  token: string,
  userName?: string,
  siteUrl: string = 'https://www.clrhoa.com'
): Promise<void> {
  const resetUrl = `${siteUrl}/auth/reset-password?token=${token}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-top: 0;">
      ${userName ? `Hi ${userName},` : 'Hello,'}
    </p>

    <p style="font-size: 16px;">
      We received a request to reset your CLRHOA portal password. If you didn't make this request, you can safely ignore this email.
    </p>

    <p style="font-size: 16px;">
      To reset your password, click the button below:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Reset Password
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${resetUrl}
    </p>

    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        <strong>⏰ This link expires in 2 hours.</strong><br>
        For your security, this reset link can only be used once.
      </p>
    </div>

    <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #721c24;">
        <strong>⚠️ Didn't request a password reset?</strong><br>
        If you didn't request this, please ignore this email. Your password will not be changed.
        If you're concerned about your account security, contact us immediately.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 13px; color: #999; margin-bottom: 5px;">
      Need help? Contact us at <a href="mailto:support@clrhoa.com" style="color: #667eea; text-decoration: none;">support@clrhoa.com</a>
    </p>

    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      This password reset was requested from IP address: ${/* IP info could go here */''}.
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
Reset Your Password

${userName ? `Hi ${userName},` : 'Hello,'}

We received a request to reset your CLRHOA portal password. If you didn't make this request, you can safely ignore this email.

To reset your password, visit this link:
${resetUrl}

⏰ This link expires in 2 hours. For your security, this reset link can only be used once.

⚠️ Didn't request a password reset?
If you didn't request this, please ignore this email. Your password will not be changed.
If you're concerned about your account security, contact us immediately.

Need help? Contact us at support@clrhoa.com

© ${new Date().getFullYear()} CLRHOA. All rights reserved.
  `.trim();

  await resend.emails.send({
    from: 'CLRHOA Portal <portal@clrhoa.com>',
    to: userEmail,
    subject: 'Reset your CLRHOA password',
    html: htmlBody,
    text: textBody,
  });
}
