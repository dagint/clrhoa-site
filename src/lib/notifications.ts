/**
 * Phase 3.5: Configurable email (Resend or MailChannels) + Twilio SMS.
 * All recipient emails come from env (NOTIFY_BOARD_EMAIL, NOTIFY_ARB_EMAIL, NOTIFY_NOREPLY_EMAIL).
 * No hardcoded emails.
 *
 * Email provider: if RESEND_API_KEY is set, use Resend; else if MAILCHANNELS_API_KEY is set, use MailChannels.
 * See docs/EMAIL_PROVIDER_OPTIONS.md for alternatives (e.g. Google Workspace SMTP).
 *
 * Per-type preferences: users can opt in/out of specific notification types (see NOTIFICATION_TYPES).
 * Prefs stored as JSON on users.notification_preferences; missing key = send (default).
 */

/** HTML-escape user input to prevent XSS in email templates */
function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Validate and sanitize email address format */
function validateEmail(email: string): string {
  const sanitized = email.trim().toLowerCase();
  // Basic RFC 5322 email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email address format');
  }
  // Prevent header injection
  if (sanitized.includes('\n') || sanitized.includes('\r') || sanitized.includes('%0a') || sanitized.includes('%0d')) {
    throw new Error('Invalid characters in email address');
  }
  return sanitized;
}

/** Sanitize text content for SMS to prevent injection */
function sanitizeSmsContent(message: string): string {
  if (!message) return '';
  // Remove potentially dangerous characters and limit length
  return String(message)
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
    .slice(0, 1600); // Truncate to SMS limit
}

/** Safely format date, returning fallback on error */
function safeFormatDate(dateStr: string, format?: Intl.DateTimeFormatOptions): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', format || {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
}

export type NotificationType =
  | 'feedback_new_doc'
  | 'feedback_response_confirm'
  | 'feedback_reminder'
  | 'assessments_due'
  | 'arb_updates'
  | 'arb_signature_submitted'
  | 'arb_signature_verified'
  | 'maintenance_updates'
  | 'general';

export const NOTIFICATION_TYPES: {
  id: NotificationType;
  label: string;
  description: string;
}[] = [
  { id: 'feedback_new_doc', label: 'New feedback requests', description: 'When the board posts a new document for your feedback or sign-off' },
  { id: 'feedback_response_confirm', label: 'Feedback confirmation', description: 'Confirmation email after you submit feedback on a document' },
  { id: 'feedback_reminder', label: 'Feedback reminders', description: 'Reminders before a feedback deadline (if enabled)' },
  { id: 'assessments_due', label: 'Dues / assessment reminders', description: 'Reminders when assessments are due or overdue (if enabled)' },
  { id: 'arb_updates', label: 'ARB request updates', description: 'Updates on your architectural review requests' },
  { id: 'arb_signature_submitted', label: 'ARB signature confirmations', description: 'Confirmation when you electronically sign an ARB request' },
  { id: 'arb_signature_verified', label: 'ARB signature verification', description: 'Notification when your signature is verified by the board' },
  { id: 'maintenance_updates', label: 'Maintenance request updates', description: 'Updates on your maintenance requests' },
  { id: 'general', label: 'General HOA announcements', description: 'General community and board announcements' },
];

/**
 * Whether to send a notification of the given type to a user. Default true if prefs null/undefined or key missing (opt-out model).
 */
export function shouldSendNotification(
  prefs: Record<string, boolean> | null | undefined,
  type: string
): boolean {
  if (prefs == null || typeof prefs !== 'object') return true;
  if (!Object.prototype.hasOwnProperty.call(prefs, type)) return true;
  return prefs[type] === true;
}

export interface NotificationEnv {
  NOTIFY_BOARD_EMAIL?: string;
  NOTIFY_ARB_EMAIL?: string;
  NOTIFY_NOREPLY_EMAIL?: string;
  RESEND_API_KEY?: string;
  MAILCHANNELS_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAILCHANNELS_ENDPOINT = 'https://api.mailchannels.net/tx/v1/send';
const FROM_NAME = 'Crooked Lake Reserve HOA';

/**
 * Send email via Resend or MailChannels. If RESEND_API_KEY is set, use Resend; else use MailChannels.
 * Skips send if no provider is configured or from/to is missing (no-op).
 */
export async function sendEmail(
  env: NotificationEnv,
  to: string,
  subject: string,
  body: string,
  options?: { html?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const from = env.NOTIFY_NOREPLY_EMAIL?.trim();
  const toTrimmed = to?.trim();
  if (!from) {
    return { ok: false, error: 'Missing sender: set NOTIFY_NOREPLY_EMAIL in env (e.g. noreply@yourdomain.com)' };
  }
  if (!toTrimmed) {
    return { ok: false, error: 'Missing recipient (to)' };
  }

  if (env.RESEND_API_KEY) {
    return sendEmailResend(env.RESEND_API_KEY, from, toTrimmed, subject, body, options);
  }
  if (env.MAILCHANNELS_API_KEY) {
    return sendEmailMailChannels(env.MAILCHANNELS_API_KEY, from, toTrimmed, subject, body, options);
  }
  return { ok: false, error: 'No email provider configured (set RESEND_API_KEY or MAILCHANNELS_API_KEY)' };
}

async function sendEmailResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  body: string,
  options?: { html?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const fromHeader = from.includes('@') ? `${FROM_NAME} <${from}>` : from;
  const payload: { from: string; to: string; subject: string; html?: string; text?: string } = {
    from: fromHeader,
    to,
    subject,
  };
  if (options?.html !== false) {
    payload.html = body;
  } else {
    payload.text = body;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendEmailMailChannels(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  body: string,
  options?: { html?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const contentType = options?.html !== false ? 'text/html' : 'text/plain';
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: FROM_NAME },
    subject,
    content: [{ type: contentType, value: body }],
  };
  try {
    const res = await fetch(MAILCHANNELS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `MailChannels ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Send SMS via Twilio REST API. Uses env.TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.
 * Skips if config missing.
 */
export async function sendSMS(
  env: NotificationEnv,
  toPhone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from || !toPhone?.trim()) {
    return { ok: false, error: 'Missing Twilio config or recipient' };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    To: toPhone.trim(),
    From: from,
    Body: sanitizeSmsContent(message),
  });
  const auth = btoa(`${sid}:${token}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Twilio ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Send signature submission confirmation email to user
 */
export async function sendSignatureSubmittedEmail(
  env: NotificationEnv,
  recipientEmail: string,
  options: {
    requestId: string;
    signatureId: string;
    signerName: string;
    documentType: string;
    verificationCode: string;
    timestamp: string;
    originUrl: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const subject = `ARB Request ${options.requestId} - Signature Confirmation`;
  const body = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">✓ Electronic Signature Confirmed</h1>
      </div>

      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0;">Your electronic signature has been successfully recorded for:</p>

        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Document:</strong> ARB Request #${escapeHtml(options.requestId)}</p>
          <p style="margin: 5px 0;"><strong>Signed by:</strong> ${escapeHtml(options.signerName)}</p>
          <p style="margin: 5px 0;"><strong>Timestamp:</strong> ${escapeHtml(safeFormatDate(options.timestamp, {
            year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
          }))}</p>
          <p style="margin: 5px 0;"><strong>Verification Code:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${escapeHtml(options.verificationCode.substring(0, 8))}</code></p>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0; font-size: 14px;"><strong>Legal Compliance</strong></p>
          <p style="margin: 5px 0; font-size: 13px; color: #1e40af;">
            Your electronic signature is legally binding under the ESIGN Act (15 U.S.C. § 7001).
            A secure record has been maintained including your consent, timestamp, and signature verification code.
          </p>
        </div>

        <p style="margin-bottom: 20px;">Your ARB request has been submitted and is pending review by the Architectural Review Board.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${options.originUrl}/portal/my-requests" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            View My Requests
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

        <p style="font-size: 12px; color: #6b7280; margin-bottom: 0;">
          You may request a copy of this signed document at any time. For questions, contact the ARB at
          <a href="mailto:${validateEmail(env.NOTIFY_ARB_EMAIL || 'arb@example.com')}" style="color: #059669;">${escapeHtml(env.NOTIFY_ARB_EMAIL || 'arb@example.com')}</a>.
        </p>
      </div>
    </div>
  `;

  return sendEmail(env, recipientEmail, subject, body, { html: true });
}

/**
 * Send signature verification notification to user (when ARB views/verifies signature)
 */
export async function sendSignatureVerifiedEmail(
  env: NotificationEnv,
  recipientEmail: string,
  options: {
    requestId: string;
    verifiedBy: string;
    verifiedAt: string;
    originUrl: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const subject = `ARB Request ${options.requestId} - Signature Verified`;
  const body = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">🔍 Signature Verified</h1>
      </div>

      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0;">The ARB has reviewed and verified your electronic signature for request #${escapeHtml(options.requestId)}.</p>

        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Verified by:</strong> ${escapeHtml(options.verifiedBy)}</p>
          <p style="margin: 5px 0;"><strong>Verified at:</strong> ${escapeHtml(safeFormatDate(options.verifiedAt))}</p>
        </div>

        <p>Your request is being reviewed. You will receive updates as the review process continues.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${options.originUrl}/portal/my-requests" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            View Request Status
          </a>
        </div>
      </div>
    </div>
  `;

  return sendEmail(env, recipientEmail, subject, body, { html: true });
}

/**
 * Send ARB notification when new signed request is submitted
 */
export async function sendArbNewSignedRequestEmail(
  env: NotificationEnv,
  options: {
    requestId: string;
    ownerEmail: string;
    ownerName: string;
    propertyAddress: string;
    signatureId: string;
    signedAt: string;
    originUrl: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const arbEmail = env.NOTIFY_ARB_EMAIL;
  if (!arbEmail) return { ok: false, error: 'Missing NOTIFY_ARB_EMAIL' };

  const subject = `New ARB Request #${options.requestId} (Electronically Signed)`;
  const body = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📝 New ARB Request Submitted</h1>
      </div>

      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0;">A new ARB request has been submitted with a legally compliant electronic signature.</p>

        <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Request ID:</strong> ${escapeHtml(options.requestId)}</p>
          <p style="margin: 5px 0;"><strong>Submitted by:</strong> ${escapeHtml(options.ownerName)} (${escapeHtml(options.ownerEmail)})</p>
          <p style="margin: 5px 0;"><strong>Property:</strong> ${escapeHtml(options.propertyAddress)}</p>
          <p style="margin: 5px 0;"><strong>Signed at:</strong> ${escapeHtml(safeFormatDate(options.signedAt))}</p>
        </div>

        <div style="background: #d1fae5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0; font-size: 14px;"><strong>✓ ESIGN Act Compliant</strong></p>
          <p style="margin: 5px 0; font-size: 13px; color: #065f46;">
            This request includes a compliant electronic signature with consent acknowledgment, timestamp,
            IP address, and verification code. All audit logs are maintained for compliance.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${options.originUrl}/portal/arb-dashboard" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Review Request & Signature
          </a>
        </div>
      </div>
    </div>
  `;

  return sendEmail(env, arbEmail, subject, body, { html: true });
}
