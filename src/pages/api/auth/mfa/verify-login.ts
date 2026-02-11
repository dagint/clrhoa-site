/**
 * POST /api/auth/mfa/verify-login
 *
 * Verify MFA code during login and complete authentication.
 *
 * Request Body:
 * - email: User's email (from login form)
 * - code: 6-digit TOTP code OR 8-character backup code
 * - tempToken: Temporary token from initial login (proves password was correct)
 *
 * Flow:
 * 1. Validate temp token (proves user provided correct password)
 * 2. Retrieve MFA secret from KV
 * 3. Verify TOTP code OR backup code
 * 4. If backup code used, mark as used
 * 5. Create session (complete login)
 * 6. Set session cookie
 * 7. Log successful MFA login
 *
 * Security:
 * - Temp token expires in 5 minutes
 * - Rate limited verification attempts
 * - Backup codes single-use only
 * - Audit logging
 *
 * Response:
 * - 200: Login successful (session created)
 * - 400: Invalid request
 * - 401: Invalid code or temp token
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import {
  verifyTOTP,
  verifyBackupCode,
  getMFASecret,
} from '../../../../lib/mfa';
import { createSession } from '../../../../lib/lucia/session';
import { createLucia } from '../../../../lib/lucia';
import { logSecurityEvent, logAuthEvent } from '../../../../lib/audit-log';
import { checkRateLimit } from '../../../../lib/rate-limit';

interface VerifyMFALoginRequest {
  email: string;
  code: string;
  tempToken: string;
}

export const POST: APIRoute = async (context) => {
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
    // 1. Parse request body
    let body: VerifyMFALoginRequest;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email, code, tempToken } = body;

    if (!email || !code || !tempToken) {
      return new Response(
        JSON.stringify({ error: 'Email, code, and temp token are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Rate limiting (10 attempts per 15 minutes)
    const rateLimitResult = await checkRateLimit(
      kv,
      `/api/auth/mfa/verify-login:${normalizedEmail}`,
      ipAddress,
      10,
      15 * 60
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'mfa_login_rate_limit',
        severity: 'warning',
        userId: normalizedEmail,
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

    // 3. Verify temp token (proves password was correct in first step)
    const tempTokenData = await kv.get(`mfa_temp_token:${tempToken}`);

    if (!tempTokenData) {
      await logSecurityEvent(db, {
        eventType: 'mfa_login_invalid_temp_token',
        severity: 'warning',
        userId: normalizedEmail,
        details: {
          ip_address: ipAddress,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Invalid or expired login session. Please log in again.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email: tokenEmail } = JSON.parse(tempTokenData);

    if (tokenEmail !== normalizedEmail) {
      return new Response(
        JSON.stringify({ error: 'Invalid login session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get user from database
    const userRecord = await db
      .prepare(
        `SELECT
          email,
          role,
          name,
          status,
          mfa_enabled
        FROM users
        WHERE email = ?`
      )
      .bind(normalizedEmail)
      .first<{
        email: string;
        role: string;
        name: string | null;
        status: string;
        mfa_enabled: number;
      }>();

    if (!userRecord || userRecord.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'User not found or inactive' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (userRecord.mfa_enabled !== 1) {
      return new Response(
        JSON.stringify({ error: 'MFA is not enabled for this account' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Get MFA secret
    const secret = await getMFASecret(kv, normalizedEmail, sessionSecret);

    if (!secret) {
      await logSecurityEvent(db, {
        eventType: 'mfa_secret_not_found',
        severity: 'critical',
        userId: normalizedEmail,
        details: {
          message: 'MFA enabled but secret not found in KV',
        },
      });

      return new Response(
        JSON.stringify({
          error: 'MFA configuration error. Please contact support.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Verify code (try TOTP first, then backup code)
    let isValid = false;
    let usedBackupCode = false;
    let backupCodeId: string | undefined;

    // Try TOTP first
    if (/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      isValid = verifyTOTP(secret, code);
    }

    // If TOTP failed, try backup code (8 characters)
    if (!isValid && /^[A-Za-z0-9]{8}$/.test(code.replace(/[-\s]/g, ''))) {
      const backupCodes = await db
        .prepare(
          `SELECT id, code_hash
           FROM mfa_backup_codes
           WHERE user_id = ? AND used = 0`
        )
        .bind(normalizedEmail)
        .all<{ id: string; code_hash: string }>();

      const matchingBackupCode = backupCodes.results?.find((bc) =>
        verifyBackupCode(code, bc.code_hash)
      );

      if (matchingBackupCode) {
        isValid = true;
        usedBackupCode = true;
        backupCodeId = matchingBackupCode.id;
      }
    }

    // 7. If code is invalid, log and return error
    if (!isValid) {
      await logSecurityEvent(db, {
        eventType: 'mfa_login_invalid_code',
        severity: 'warning',
        userId: normalizedEmail,
        details: {
          ip_address: ipAddress,
          code_type: code.length === 6 ? 'totp' : 'backup',
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Invalid verification code. Please try again.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 8. If backup code was used, mark it as used
    if (usedBackupCode && backupCodeId) {
      await db
        .prepare(
          `UPDATE mfa_backup_codes
           SET used = 1,
               used_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(backupCodeId)
        .run();

      await logSecurityEvent(db, {
        eventType: 'mfa_backup_code_used',
        severity: 'info',
        userId: normalizedEmail,
        details: {
          ip_address: ipAddress,
          backup_code_id: backupCodeId,
        },
      });
    }

    // 9. Delete temp token (one-time use)
    await kv.delete(`mfa_temp_token:${tempToken}`);

    // 10. Create session (complete login)
    const lucia = createLucia(db);
    const session = await createSession(
      db,
      lucia,
      normalizedEmail,
      ipAddress,
      userAgent
    );

    // 11. Set session cookie
    const sessionCookie = lucia.createSessionCookie(session.id);
    context.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    // 12. Update last login timestamp
    await db
      .prepare(
        `UPDATE users
         SET last_login = CURRENT_TIMESTAMP,
             last_login_ip = ?,
             last_login_user_agent = ?
         WHERE email = ?`
      )
      .bind(ipAddress, userAgent, normalizedEmail)
      .run();

    // 13. Log successful MFA login
    await logAuthEvent(db, {
      eventType: 'mfa_login_successful',
      userId: normalizedEmail,
      sessionId: session.id,
      action: 'MFA login verified',
      outcome: 'success',
      ipAddress,
      userAgent,
      details: {
        backup_code_used: usedBackupCode,
      },
    });

    // 14. Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login successful!',
        redirectTo: '/portal/dashboard',
        user: {
          email: normalizedEmail,
          role: userRecord.role,
          name: userRecord.name,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('MFA login verification error:', error);

    await logSecurityEvent(db, {
      eventType: 'mfa_login_error',
      severity: 'critical',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to verify MFA code' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
