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

export type NotificationType =
  | 'feedback_new_doc'
  | 'feedback_response_confirm'
  | 'feedback_reminder'
  | 'assessments_due'
  | 'arb_updates'
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
    Body: message.slice(0, 1600),
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
