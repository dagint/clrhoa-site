/**
 * Logging utilities with PII masking for security and privacy compliance.
 */

/**
 * Generate a unique correlation ID for request tracing.
 * Format: timestamp (base36) + random (8 chars) = ~12-13 chars total
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

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
 * Safe logger that masks PII in messages and includes correlation ID for tracing.
 */
export class SafeLogger {
  private context: Record<string, any> = {};
  private correlationId: string | null = null;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
    // Extract correlationId from context if provided
    if (context.correlationId) {
      this.correlationId = String(context.correlationId);
      // Don't include it in context to avoid duplication
      const { correlationId, ...rest } = context;
      this.context = rest;
    }
  }

  /**
   * Set correlation ID for this logger instance.
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Get correlation ID prefix for log messages.
   */
  private getLogPrefix(): string {
    return this.correlationId ? `[${this.correlationId}]` : '';
  }

  /**
   * Log error with PII masking and correlation ID.
   */
  error(message: string, data?: Record<string, any>): void {
    const masked = this.maskPII({ ...this.context, ...data });
    const prefix = this.getLogPrefix();
    console.error(`${prefix}[ERROR] ${message}`, masked);
  }

  /**
   * Log warning with PII masking and correlation ID.
   */
  warn(message: string, data?: Record<string, any>): void {
    const masked = this.maskPII({ ...this.context, ...data });
    const prefix = this.getLogPrefix();
    console.warn(`${prefix}[WARN] ${message}`, masked);
  }

  /**
   * Log info with correlation ID (no masking needed for non-sensitive info).
   */
  info(message: string, data?: Record<string, any>): void {
    const prefix = this.getLogPrefix();
    console.log(`${prefix}[INFO] ${message}`, { ...this.context, ...data });
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
 * If context includes correlationId, it will be included in all log messages.
 */
export function createLogger(context: Record<string, any> = {}): SafeLogger {
  return new SafeLogger(context);
}
