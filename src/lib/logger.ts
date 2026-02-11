/**
 * Structured Logging Utility
 *
 * Provides consistent logging across the application with environment-aware
 * output (verbose in dev, structured in production).
 *
 * Usage:
 * ```typescript
 * import { logger } from './lib/logger';
 *
 * logger.info('User logged in', { userId: 'user@example.com' });
 * logger.error('Auth failed', { error: err.message });
 * logger.warn('Rate limit approaching', { ip: '1.2.3.4', count: 4 });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  environment: string;
}

/**
 * Logger configuration
 */
const config = {
  // In production, use structured JSON logs
  // In development, use human-readable console output
  isProduction: process.env.NODE_ENV === 'production',
  minLevel: (process.env.LOG_LEVEL || 'info') as LogLevel,
};

const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be output based on minimum level
 */
function shouldLog(level: LogLevel): boolean {
  return logLevels[level] >= logLevels[config.minLevel];
}

/**
 * Format log entry for production (structured JSON)
 */
function formatStructured(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Format log entry for development (human-readable)
 */
function formatHumanReadable(entry: LogEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const levelEmoji = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };

  let output = `${levelEmoji[entry.level]} [${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
  }

  return output;
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    environment: config.isProduction ? 'production' : 'development',
  };

  const formatted = config.isProduction
    ? formatStructured(entry)
    : formatHumanReadable(entry);

  // Output to appropriate stream
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

/**
 * Logger interface
 */
export const logger = {
  /**
   * Debug-level logging (verbose, development only)
   */
  debug(message: string, context?: LogContext): void {
    log('debug', message, context);
  },

  /**
   * Info-level logging (general information)
   */
  info(message: string, context?: LogContext): void {
    log('info', message, context);
  },

  /**
   * Warning-level logging (non-critical issues)
   */
  warn(message: string, context?: LogContext): void {
    log('warn', message, context);
  },

  /**
   * Error-level logging (critical issues)
   */
  error(message: string, context?: LogContext): void {
    log('error', message, context);
  },

  /**
   * Security event logging (always logged, high priority)
   * Combines with audit log for security-specific events
   */
  security(message: string, context?: LogContext): void {
    log('error', `[SECURITY] ${message}`, context);
  },
};

/**
 * Legacy console.error/warn/log replacement
 * Use this to gradually migrate from console.* to structured logging
 */
export function safeConsole(level: LogLevel, message: string, ...args: unknown[]): void {
  const context: LogContext = {};

  // Extract context from args
  args.forEach((arg, index) => {
    if (arg instanceof Error) {
      context[`error_${index}`] = {
        message: arg.message,
        stack: config.isProduction ? undefined : arg.stack,
      };
    } else if (typeof arg === 'object' && arg !== null) {
      context[`arg_${index}`] = arg;
    } else {
      context[`arg_${index}`] = String(arg);
    }
  });

  log(level, message, Object.keys(context).length > 0 ? context : undefined);
}
