/**
 * Resend Email Client Types
 *
 * Type definitions for the Resend email service used throughout the auth system.
 * These types provide compile-time safety for email operations.
 *
 * Official Resend types are not used as a dependency to keep bundle size small.
 * Instead, we define only the interfaces we actually use.
 */

/**
 * Email send request parameters
 */
export interface ResendSendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Email send response
 */
export interface ResendSendEmailResponse {
  id: string;
  from?: string;
  to?: string[];
  created_at?: string;
}

/**
 * Resend client interface
 *
 * Minimal interface covering only the methods we use.
 * Extend this as needed when using additional Resend features.
 */
export interface ResendClient {
  emails: {
    send(params: ResendSendEmailParams): Promise<ResendSendEmailResponse>;
  };
}

/**
 * Type guard to check if an object is a Resend client
 */
export function isResendClient(obj: unknown): obj is ResendClient {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'emails' in obj &&
    typeof (obj as any).emails === 'object' &&
    typeof (obj as any).emails.send === 'function'
  );
}
