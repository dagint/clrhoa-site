/**
 * POST /api/auth/mfa/setup
 *
 * Initialize MFA setup for the current user.
 * Generates a new TOTP secret and QR code for scanning.
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Generate new TOTP secret
 * 3. Generate QR code data URL
 * 4. Store secret temporarily in KV (not enabled yet)
 * 5. Return QR code and secret (for manual entry)
 *
 * Security:
 * - Requires valid session
 * - Secret encrypted before KV storage
 * - Not activated until verification succeeds
 * - Rate limited to prevent abuse
 *
 * Response:
 * - 200: Setup data (QR code, secret, backup codes will come after verification)
 * - 401: Not authenticated
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/auth/middleware';
import {
  generateMFASecret,
  generateQRCode,
  generateBackupCodes,
  storeMFASecret,
  encryptSecret,
} from '../../../../lib/mfa';
import { logSecurityEvent } from '../../../../lib/audit-log';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { getUserEmail } from '../../../../types/auth';

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

  if (!db || !kv || !sessionSecret) {
    return new Response(
      JSON.stringify({ error: 'Service not available' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 2. Rate limiting - prevent abuse (5 setups per hour)
    const rateLimitResult = await checkRateLimit(
      kv,
      '/api/auth/mfa/setup',
      userEmail,
      5,
      60 * 60
    );

    if (!rateLimitResult.allowed) {
      await logSecurityEvent(db, {
        eventType: 'mfa_setup_rate_limit',
        severity: 'warning',
        userId: userEmail,
        details: {
          ip_address: ipAddress,
          reset_at: new Date(rateLimitResult.resetAt * 1000).toISOString(),
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Too many MFA setup attempts. Please try again later.',
          resetAt: rateLimitResult.resetAt,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generate TOTP secret
    const secret = generateMFASecret();

    // 4. Generate QR code
    const qrCodeDataUrl = await generateQRCode(secret, userEmail, 'CLRHOA Portal');

    // 5. Store secret in KV (temporary, not enabled yet)
    // Store with "_pending" suffix to indicate it's not verified
    // Encrypt the secret for security
    const encryptedSecret = encryptSecret(secret, sessionSecret);
    await kv.put(
      `mfa_secret_pending:${userEmail}`,
      JSON.stringify({
        secret: encryptedSecret,
        createdAt: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 15 } // 15 minutes to complete setup
    );

    // 6. Log MFA setup initiated
    await logSecurityEvent(db, {
      eventType: 'mfa_setup_initiated',
      severity: 'info',
      userId: userEmail,
      details: {
        ip_address: ipAddress,
      },
    });

    // 7. Return setup data (QR code + manual entry secret)
    return new Response(
      JSON.stringify({
        success: true,
        qrCode: qrCodeDataUrl,
        secret, // For manual entry in authenticator apps
        message: 'Scan the QR code with your authenticator app, then verify a code to enable MFA.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('MFA setup error:', error);

    await logSecurityEvent(db, {
      eventType: 'mfa_setup_error',
      severity: 'critical',
      userId: userEmail,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip_address: ipAddress,
      },
    });

    return new Response(
      JSON.stringify({ error: 'Failed to initialize MFA setup' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
