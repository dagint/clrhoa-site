/**
 * Structured error tracking and monitoring utilities.
 * Integrates with Cloudflare Analytics and provides structured logging.
 */

export interface SecurityEvent {
  type: 'failed_login' | 'csrf_failure' | 'rate_limit' | 'unauthorized_access' | 'file_upload_failure' | 'api_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  endpoint: string;
  email?: string;
  ipAddress?: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Track security events for monitoring and alerting.
 * Events are logged to console (which Cloudflare Workers can capture) and
 * can be sent to external monitoring services if configured.
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor | null = null;

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * Log a security event.
   */
  logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Log to console (Cloudflare Workers captures this)
    const logLevel = this.getLogLevel(fullEvent.severity);
    const message = `[SECURITY] ${fullEvent.type} on ${fullEvent.endpoint}`;
    const data = {
      severity: fullEvent.severity,
      endpoint: fullEvent.endpoint,
      email: fullEvent.email ? this.maskEmail(fullEvent.email) : undefined,
      ipAddress: fullEvent.ipAddress,
      details: fullEvent.details,
      timestamp: fullEvent.timestamp,
    };

    if (logLevel === 'error') {
      console.error(message, data);
    } else if (logLevel === 'warn') {
      console.warn(message, data);
    } else {
      console.log(message, data);
    }

    // In the future, this could send to external monitoring service
    // e.g., Sentry, LogRocket, or Cloudflare Analytics API
  }

  /**
   * Track failed login attempt.
   */
  trackFailedLogin(email: string, ipAddress: string | null, reason: string): void {
    this.logEvent({
      type: 'failed_login',
      severity: 'medium',
      endpoint: '/api/login',
      email,
      ipAddress: ipAddress || undefined,
      details: { reason },
    });
  }

  /**
   * Track CSRF failure.
   */
  trackCsrfFailure(endpoint: string, ipAddress: string | null): void {
    this.logEvent({
      type: 'csrf_failure',
      severity: 'high',
      endpoint,
      ipAddress: ipAddress || undefined,
      details: { message: 'CSRF token validation failed' },
    });
  }

  /**
   * Track rate limit hit.
   */
  trackRateLimit(endpoint: string, email: string | null, ipAddress: string | null): void {
    this.logEvent({
      type: 'rate_limit',
      severity: 'medium',
      endpoint,
      email: email || undefined,
      ipAddress: ipAddress || undefined,
      details: { message: 'Rate limit exceeded' },
    });
  }

  /**
   * Track unauthorized access attempt.
   */
  trackUnauthorizedAccess(endpoint: string, email: string | null, ipAddress: string | null, reason: string): void {
    this.logEvent({
      type: 'unauthorized_access',
      severity: 'high',
      endpoint,
      email: email || undefined,
      ipAddress: ipAddress || undefined,
      details: { reason },
    });
  }

  /**
   * Track API error.
   */
  trackApiError(endpoint: string, error: Error | string, context?: Record<string, any>): void {
    this.logEvent({
      type: 'api_error',
      severity: 'medium',
      endpoint,
      details: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
      },
    });
  }

  /**
   * Track file upload failure.
   */
  trackFileUploadFailure(endpoint: string, reason: string, fileInfo?: { name?: string; size?: number }): void {
    this.logEvent({
      type: 'file_upload_failure',
      severity: 'low',
      endpoint,
      details: {
        reason,
        fileName: fileInfo?.name,
        fileSize: fileInfo?.size,
      },
    });
  }

  private getLogLevel(severity: SecurityEvent['severity']): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      default:
        return 'log';
    }
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '[invalid email]';
    const [local, domain] = parts;
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 3))}@${domain}`;
  }
}

/**
 * Get the security monitor instance.
 */
export function getSecurityMonitor(): SecurityMonitor {
  return SecurityMonitor.getInstance();
}
