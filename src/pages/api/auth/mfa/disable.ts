/**
 * POST /api/auth/mfa/disable
 *
 * Disable MFA for the current user.
 *
 * Request Body:
 * - password: User's current password (for verification)
 * - code: 6-digit TOTP code OR backup code (optional but recommended)
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Verify password matches
 * 3. Optionally verify TOTP/backup code
 * 4. Delete MFA secret from KV
 * 5. Delete backup codes from database
 * 6. Update user mfa_enabled flag
 * 7. Log MFA disabled event
 *
 * Security:
 * - Requires current password
 * - Optionally requires TOTP/backup code (best practice)
 * - Rate limited to prevent abuse
 * - Audit logging
 *
 * Response:
 * - 200: MFA disabled successfully
 * - 400: Invalid request
 * - 401: Invalid password or code
 * - 404: MFA not enabled
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/auth/middleware';
import { verifyPassword } from '../../../../lib/password';
import {
  verifyTOTP,
  verifyBackupCode,
  getMFASecret,
  deleteMFASecret,
} from '../../../../lib/mfa';
import { logSecurityEvent } from '../../../../lib/audit-log';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { getUserEmail } from '../../../../types/auth';

interface DisableMFARequest {
  password: string;
  code?: string; // Optional TOTP or backup code
}

export const POST: APIRoute = async (context) => {
  // 1. Check authentication
  const authResult = await requireAuth(context);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const { user } = authResult;
  const userEmail = getUserEmail(user) || 'unknown';

  const db = context.locals.runtime?.env?.DB;
  const kv = context.locals.runtime?.env?.KV as KVNamespace | undefined;
  const sessionSecret = context.locals.runtime?.env?.SESSION_SECRET;
  const ipAddress = context.request.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = context.request.headers.get('user-agent') || 'unknown';

  if (!db || !kv || !sessionSecret) {
    return new Response(
      JSON.stringify({ error: 'Service not available' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. Parse request body
    let body: DisableMFARequest;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { password, code } = body;

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required to disable MFA' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Rate limiting (5 attempts per hour)
    const rateLimitResult = await checkRateLimit(
      kv,
      '/api/auth/mfa/disable',
      userEmail,
      5,
      60 * 60
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'mfa_disable_rate_limit',
        severity: 'warning',
        userId: userEmail,
        details: {
          ip_address: ipAddress,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Too many attempts. Please try again later.',
          resetAt: rateLimitResult.resetAt,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get user from database
    const userRecord = await db
      .prepare(
        `SELECT
          email,
          password_hash,
          mfa_enabled
        FROM users
        WHERE email = ?`
      )
      .bind(userEmail)
      .first<{
        email: string;
        password_hash: string | null;
        mfa_enabled: number;
      }>();

    if (!userRecord || !userRecord.password_hash) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check if MFA is enabled
    if (userRecord.mfa_enabled !== 1) {
      return new Response(
        JSON.stringify({ error: 'MFA is not enabled for this account' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Verify password
    const isPasswordValid = await verifyPassword(password, userRecord.password_hash);

    if (!isPasswordValid) {
      await logSecurityEvent(db, {
        eventType: 'mfa_disable_invalid_password',
        severity: 'warning',
        userId: userEmail,
        details: {
          ip_address: ipAddress,
        },
      });

      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Optionally verify TOTP/backup code (recommended for extra security)
    if (code) {
      const secret = await getMFASecret(kv, userEmail, sessionSecret);

      if (secret) {
        // Try TOTP first
        const isTOTPValid = verifyTOTP(secret, code);

        if (!isTOTPValid) {
          // Try backup code
          const backupCodes = await db
            .prepare(
              `SELECT id, code_hash
               FROM mfa_backup_codes
               WHERE user_id = ? AND used = 0`
            )
            .bind(userEmail)
            .all<{ id: string; code_hash: string }>();

          const matchingBackupCode = backupCodes.results?.find((bc) =>
            verifyBackupCode(code, bc.code_hash)
          );

          if (!matchingBackupCode) {
            await logSecurityEvent(db, {
              eventType: 'mfa_disable_invalid_code',
              severity: 'warning',
              userId: userEmail,
              details: {
                ip_address: ipAddress,
              },
            });

            return new Response(
              JSON.stringify({ error: 'Invalid verification code' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Mark backup code as used
          await db
            .prepare(
              `UPDATE mfa_backup_codes
               SET used = 1,
                   used_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            )
            .bind(matchingBackupCode.id)
            .run();
        }
      }
    }

    // 8. Delete MFA secret from KV
    await deleteMFASecret(kv, userEmail);

    // 9. Delete backup codes from database
    await db
      .prepare(
        `DELETE FROM mfa_backup_codes
         WHERE user_id = ?`
      )
      .bind(userEmail)
      .run();

    // 10. Update user MFA disabled flag
    await db
      .prepare(
        `UPDATE users
         SET mfa_enabled = 0,
             mfa_enabled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`
      )
      .bind(userEmail)
      .run();

    // 11. Log MFA disabled event
    await logSecurityEvent(db, {
      eventType: 'mfa_disabled',
      severity: 'info',
      userId: userEmail,
      details: {
        ip_address: ipAddress,
        user_agent: userAgent,
        verified_with_code: !!code,
      },
    });

    // 12. Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'MFA has been disabled for your account.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('MFA disable error:', error);

    await logSecurityEvent(db, {
      eventType: 'mfa_disable_error',
      severity: 'critical',
      userId: userEmail,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to disable MFA' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
