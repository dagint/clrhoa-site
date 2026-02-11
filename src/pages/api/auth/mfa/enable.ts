/**
 * POST /api/auth/mfa/enable
 *
 * Verify TOTP code and enable MFA for the user.
 *
 * Request Body:
 * - code: 6-digit TOTP code from authenticator app
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Retrieve pending MFA secret from KV
 * 3. Verify TOTP code
 * 4. Generate backup codes
 * 5. Store backup codes in database (hashed)
 * 6. Move secret from pending to active in KV
 * 7. Update user mfa_enabled flag in database
 * 8. Log MFA enabled event
 * 9. Return backup codes to user (only shown once!)
 *
 * Security:
 * - Requires valid TOTP code to activate
 * - Backup codes hashed before storage
 * - Rate limited verification attempts
 * - Audit logging
 *
 * Response:
 * - 200: MFA enabled successfully (includes backup codes)
 * - 400: Invalid or missing code
 * - 401: Not authenticated or invalid code
 * - 404: No pending MFA setup found
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/auth/middleware';
import {
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  formatBackupCode,
  storeMFASecret,
  decryptSecret,
} from '../../../../lib/mfa';
import { logSecurityEvent } from '../../../../lib/audit-log';
import { checkRateLimit } from '../../../../lib/rate-limit';
import crypto from 'node:crypto';

interface EnableMFARequest {
  code: string;
}

export const POST: APIRoute = async (context) => {
  // 1. Check authentication
  const authResult = await requireAuth(context);
  if (authResult.redirect) {
    return authResult.redirect;
  }

  const { user } = authResult;
  const userEmail = (user as any).email;

  const db = context.locals.runtime?.env?.DB;
  const kv = context.locals.runtime?.env?.CLRHOA_USERS as KVNamespace | undefined;
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
    let body: EnableMFARequest;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { code } = body;

    if (!code || !/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification code. Please enter a 6-digit code.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Rate limiting - prevent brute force (10 attempts per hour)
    const rateLimitResult = await checkRateLimit(
      kv,
      '/api/auth/mfa/enable',
      userEmail,
      10,
      60 * 60
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'mfa_enable_rate_limit',
        severity: 'warning',
        userId: userEmail,
        details: {
          ip_address: ipAddress,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Too many verification attempts. Please try again later.',
          resetAt: rateLimitResult.resetAt,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Retrieve pending MFA secret
    const pendingData = await kv.get(`mfa_secret_pending:${userEmail}`);

    if (!pendingData) {
      return new Response(
        JSON.stringify({
          error: 'No pending MFA setup found. Please start MFA setup first.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { secret: encryptedSecret } = JSON.parse(pendingData);

    // Decrypt the secret
    let secret: string;
    try {
      secret = decryptSecret(encryptedSecret, sessionSecret);
    } catch (error) {
      console.error('Failed to decrypt pending MFA secret:', error);
      return new Response(
        JSON.stringify({
          error: 'Invalid MFA setup. Please start MFA setup again.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Verify TOTP code
    const isValid = verifyTOTP(secret, code);

    if (!isValid) {
      await logSecurityEvent(db, {
        eventType: 'mfa_enable_invalid_code',
        severity: 'warning',
        userId: userEmail,
        details: {
          ip_address: ipAddress,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Invalid verification code. Please check your authenticator app and try again.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Generate backup codes
    const backupCodes = generateBackupCodes(10);
    const formattedBackupCodes = backupCodes.map(formatBackupCode);

    // 7. Store backup codes in database (hashed)
    for (const code of backupCodes) {
      const codeHash = hashBackupCode(code);
      const codeId = crypto.randomUUID();

      await db
        .prepare(
          `INSERT INTO mfa_backup_codes (
            id,
            user_id,
            code_hash,
            used,
            created_at
          ) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`
        )
        .bind(codeId, userEmail, codeHash)
        .run();
    }

    // 8. Move secret from pending to active in KV
    await storeMFASecret(kv, userEmail, secret, sessionSecret);

    // Delete pending secret
    await kv.delete(`mfa_secret_pending:${userEmail}`);

    // 9. Update user MFA enabled flag in database
    await db
      .prepare(
        `UPDATE users
         SET mfa_enabled = 1,
             mfa_enabled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = ?`
      )
      .bind(userEmail)
      .run();

    // 10. Log MFA enabled event
    await logSecurityEvent(db, {
      eventType: 'mfa_enabled',
      severity: 'info',
      userId: userEmail,
      details: {
        ip_address: ipAddress,
        user_agent: userAgent,
        backup_codes_generated: backupCodes.length,
      },
    });

    // 11. Return success with backup codes
    return new Response(
      JSON.stringify({
        success: true,
        message: 'MFA enabled successfully!',
        backupCodes: formattedBackupCodes,
        warning: 'Save these backup codes in a secure location. They will not be shown again.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('MFA enable error:', error);

    await logSecurityEvent(db, {
      eventType: 'mfa_enable_error',
      severity: 'critical',
      userId: userEmail,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to enable MFA' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
