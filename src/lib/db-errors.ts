/**
 * Database Error Handling Utilities
 *
 * Provides user-friendly error messages for database constraint violations
 * and other database-specific errors in Cloudflare D1.
 *
 * Usage:
 * ```typescript
 * import { handleDatabaseError, isDuplicateKeyError } from './db-errors';
 *
 * try {
 *   await db.prepare('INSERT INTO users...').run();
 * } catch (error) {
 *   const userMessage = handleDatabaseError(error, 'user');
 *   return new Response(JSON.stringify({ error: userMessage }), { status: 409 });
 * }
 * ```
 */

/**
 * Database error types that we handle specially
 */
export enum DatabaseErrorType {
  UNIQUE_CONSTRAINT = 'UNIQUE_CONSTRAINT',
  FOREIGN_KEY = 'FOREIGN_KEY',
  NOT_NULL = 'NOT_NULL',
  CHECK_CONSTRAINT = 'CHECK_CONSTRAINT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Parsed database error information
 */
export interface ParsedDatabaseError {
  type: DatabaseErrorType;
  constraintName?: string;
  columnName?: string;
  tableName?: string;
  originalMessage: string;
}

/**
 * SQLite/D1 error patterns
 */
const ERROR_PATTERNS = {
  uniqueConstraint: /UNIQUE constraint failed: (\w+)\.(\w+)/i,
  foreignKey: /FOREIGN KEY constraint failed/i,
  notNull: /NOT NULL constraint failed: (\w+)\.(\w+)/i,
  checkConstraint: /CHECK constraint failed: (\w+)/i,
};

/**
 * Parse a database error to extract structured information
 */
export function parseDatabaseError(error: unknown): ParsedDatabaseError {
  const message = error instanceof Error ? error.message : String(error);

  // Check for unique constraint violation
  const uniqueMatch = message.match(ERROR_PATTERNS.uniqueConstraint);
  if (uniqueMatch) {
    return {
      type: DatabaseErrorType.UNIQUE_CONSTRAINT,
      tableName: uniqueMatch[1],
      columnName: uniqueMatch[2],
      originalMessage: message,
    };
  }

  // Check for foreign key constraint
  if (ERROR_PATTERNS.foreignKey.test(message)) {
    return {
      type: DatabaseErrorType.FOREIGN_KEY,
      originalMessage: message,
    };
  }

  // Check for NOT NULL constraint
  const notNullMatch = message.match(ERROR_PATTERNS.notNull);
  if (notNullMatch) {
    return {
      type: DatabaseErrorType.NOT_NULL,
      tableName: notNullMatch[1],
      columnName: notNullMatch[2],
      originalMessage: message,
    };
  }

  // Check for CHECK constraint
  const checkMatch = message.match(ERROR_PATTERNS.checkConstraint);
  if (checkMatch) {
    return {
      type: DatabaseErrorType.CHECK_CONSTRAINT,
      constraintName: checkMatch[1],
      originalMessage: message,
    };
  }

  // Unknown error type
  return {
    type: DatabaseErrorType.UNKNOWN,
    originalMessage: message,
  };
}

/**
 * Type guard to check if error is a duplicate key error
 */
export function isDuplicateKeyError(error: unknown): boolean {
  const parsed = parseDatabaseError(error);
  return parsed.type === DatabaseErrorType.UNIQUE_CONSTRAINT;
}

/**
 * Type guard to check if error is a foreign key error
 */
export function isForeignKeyError(error: unknown): boolean {
  const parsed = parseDatabaseError(error);
  return parsed.type === DatabaseErrorType.FOREIGN_KEY;
}

/**
 * Type guard to check if error is a NOT NULL constraint error
 */
export function isNotNullError(error: unknown): boolean {
  const parsed = parseDatabaseError(error);
  return parsed.type === DatabaseErrorType.NOT_NULL;
}

/**
 * Generate user-friendly error message based on resource type and error
 */
export function handleDatabaseError(
  error: unknown,
  resourceType: 'user' | 'session' | 'token' | 'request' | 'resource' = 'resource'
): string {
  const parsed = parseDatabaseError(error);

  switch (parsed.type) {
    case DatabaseErrorType.UNIQUE_CONSTRAINT:
      return generateUniqueConstraintMessage(parsed, resourceType);

    case DatabaseErrorType.FOREIGN_KEY:
      return `Cannot complete operation: related ${resourceType} not found or in use.`;

    case DatabaseErrorType.NOT_NULL:
      if (parsed.columnName) {
        const fieldName = formatFieldName(parsed.columnName);
        return `${fieldName} is required and cannot be empty.`;
      }
      return `Required field is missing.`;

    case DatabaseErrorType.CHECK_CONSTRAINT:
      return `Invalid data: constraint validation failed.`;

    case DatabaseErrorType.UNKNOWN:
    default:
      // Don't expose internal errors to users
      return `Failed to save ${resourceType}. Please try again.`;
  }
}

/**
 * Generate user-friendly message for unique constraint violations
 */
function generateUniqueConstraintMessage(
  parsed: ParsedDatabaseError,
  resourceType: string
): string {
  const { tableName, columnName } = parsed;

  // Handle common unique constraint scenarios
  if (tableName === 'users' && columnName === 'email') {
    return 'A user with this email address already exists.';
  }

  if (tableName === 'sessions' && columnName === 'id') {
    return 'Session conflict detected. Please try again.';
  }

  if (columnName === 'email') {
    return 'This email address is already in use.';
  }

  if (columnName === 'token' || columnName === 'token_hash') {
    return 'Token conflict detected. Please request a new one.';
  }

  // Generic message
  if (columnName) {
    const fieldName = formatFieldName(columnName);
    return `This ${fieldName} is already in use.`;
  }

  return `This ${resourceType} already exists.`;
}

/**
 * Convert snake_case database column name to human-readable format
 */
function formatFieldName(columnName: string): string {
  return columnName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get appropriate HTTP status code for database error
 */
export function getDatabaseErrorStatus(error: unknown): number {
  const parsed = parseDatabaseError(error);

  switch (parsed.type) {
    case DatabaseErrorType.UNIQUE_CONSTRAINT:
      return 409; // Conflict

    case DatabaseErrorType.FOREIGN_KEY:
      return 400; // Bad Request

    case DatabaseErrorType.NOT_NULL:
      return 400; // Bad Request

    case DatabaseErrorType.CHECK_CONSTRAINT:
      return 400; // Bad Request

    case DatabaseErrorType.UNKNOWN:
    default:
      return 500; // Internal Server Error
  }
}

/**
 * Create a standardized error response for database errors
 */
export function createDatabaseErrorResponse(
  error: unknown,
  resourceType: 'user' | 'session' | 'token' | 'request' | 'resource' = 'resource'
): Response {
  const message = handleDatabaseError(error, resourceType);
  const status = getDatabaseErrorStatus(error);

  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
