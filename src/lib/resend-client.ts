/**
 * Lightweight Resend Email Client
 *
 * A minimal implementation of the ResendClient interface that uses fetch()
 * instead of the full Resend SDK. This keeps bundle size small while providing
 * the same interface expected by auth endpoints.
 *
 * Usage:
 * ```typescript
 * import { createResendClient } from './lib/resend-client';
 *
 * const resend = createResendClient(env.RESEND_API_KEY);
 * await resend.emails.send({ from, to, subject, html, text });
 * ```
 */

import type { ResendClient, ResendSendEmailParams, ResendSendEmailResponse } from '../types/resend';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Create a Resend client from an API key.
 *
 * @param apiKey - Resend API key (re_...)
 * @returns ResendClient instance
 */
export function createResendClient(apiKey: string): ResendClient {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('RESEND_API_KEY is required');
  }

  return {
    emails: {
      async send(params: ResendSendEmailParams): Promise<ResendSendEmailResponse> {
        try {
          const response = await fetch(RESEND_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(params),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Resend API error (${response.status})`;

            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorJson.error || errorText;
            } catch {
              errorMessage = errorText || errorMessage;
            }

            throw new Error(errorMessage);
          }

          const result = await response.json() as ResendSendEmailResponse;
          return result;
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error(`Failed to send email: ${String(error)}`);
        }
      },
    },
  };
}

/**
 * Get or create a Resend client from the environment.
 *
 * This function checks if env.RESEND is already a client instance,
 * and if not, creates one from RESEND_API_KEY.
 *
 * @param env - Cloudflare environment with RESEND or RESEND_API_KEY
 * @returns ResendClient instance or undefined if no API key
 */
export function getResendClient(env: {
  RESEND?: unknown;
  RESEND_API_KEY?: string;
}): ResendClient | undefined {
  // If RESEND is already a client, use it
  if (env.RESEND && typeof env.RESEND === 'object' && 'emails' in env.RESEND) {
    return env.RESEND as ResendClient;
  }

  // Otherwise, create client from API key
  if (env.RESEND_API_KEY && env.RESEND_API_KEY.trim()) {
    return createResendClient(env.RESEND_API_KEY);
  }

  return undefined;
}
