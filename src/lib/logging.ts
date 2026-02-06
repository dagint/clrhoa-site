/**
 * Logging utilities with PII masking for security and privacy compliance.
 */

/**
 * Mask email address: j***@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '[no email]';
  const parts = email.split('@');
  if (parts.length !== 2) return '[invalid email]';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 3))}@${domain}`;
}

/**
 * Mask phone number: ***-***-1234
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '[no phone]';
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '[invalid phone]';
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

/**
 * Mask property address: 123 *** St
 */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return '[no address]';
  // Keep first few characters, mask the rest
  if (address.length <= 5) return '***';
  const keep = address.substring(0, Math.min(5, address.length));
  return `${keep}***`;
}

/**
 * Mask request ID: show only last 4 characters
 */
export function maskRequestId(id: string | null | undefined): string {
  if (!id) return '[no id]';
  if (id.length <= 4) return '***';
  return `***${id.slice(-4)}`;
}

/**
 * Safe logger that masks PII in messages.
 */
export class SafeLogger {
  private context: Record<string, any> = {};

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  /**
   * Log error with PII masking.
   */
  error(message: string, data?: Record<string, any>): void {
    const masked = this.maskPII({ ...this.context, ...data });
    console.error(`[ERROR] ${message}`, masked);
  }

  /**
   * Log warning with PII masking.
   */
  warn(message: string, data?: Record<string, any>): void {
    const masked = this.maskPII({ ...this.context, ...data });
    console.warn(`[WARN] ${message}`, masked);
  }

  /**
   * Log info (no masking needed for non-sensitive info).
   */
  info(message: string, data?: Record<string, any>): void {
    console.log(`[INFO] ${message}`, { ...this.context, ...data });
  }

  /**
   * Mask PII in data object.
   */
  private maskPII(data: Record<string, any>): Record<string, any> {
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('email')) {
        masked[key] = maskEmail(String(value));
      } else if (keyLower.includes('phone')) {
        masked[key] = maskPhone(String(value));
      } else if (keyLower.includes('address') || keyLower.includes('property')) {
        masked[key] = maskAddress(String(value));
      } else if (keyLower.includes('request_id') || keyLower.includes('requestid') || keyLower === 'id') {
        masked[key] = maskRequestId(String(value));
      } else if (typeof value === 'object' && value !== null) {
        // Recursively mask nested objects
        masked[key] = this.maskPII(value as Record<string, any>);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
}

/**
 * Create a logger instance with context.
 */
export function createLogger(context: Record<string, any> = {}): SafeLogger {
  return new SafeLogger(context);
}
