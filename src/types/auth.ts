/**
 * Authentication Type Definitions
 *
 * Type-safe definitions for authenticated users and auth-related data structures.
 * Replaces usage of "any" types throughout the auth system.
 */

/**
 * Valid user roles in the system
 */
export type UserRole = 'member' | 'arb' | 'board' | 'arb_board' | 'admin';

/**
 * Valid user statuses
 */
export type UserStatus = 'active' | 'pending_setup' | 'inactive';

/**
 * Authenticated user from Lucia session
 *
 * This type represents the user object returned from session validation.
 * It matches the structure defined in DatabaseUserAttributes and getUserAttributes.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * Type guard to check if an object is an authenticated user
 */
export function isAuthenticatedUser(obj: unknown): obj is AuthenticatedUser {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    'role' in obj &&
    'status' in obj &&
    typeof (obj as any).id === 'string' &&
    typeof (obj as any).email === 'string' &&
    typeof (obj as any).role === 'string' &&
    typeof (obj as any).status === 'string'
  );
}

/**
 * Extract email from authenticated user or unknown object safely
 */
export function getUserEmail(user: unknown): string | null {
  if (isAuthenticatedUser(user)) {
    return user.email;
  }
  // Fallback for legacy code
  if (typeof user === 'object' && user !== null && 'email' in user) {
    const email = (user as any).email;
    return typeof email === 'string' ? email : null;
  }
  return null;
}

/**
 * Extract role from authenticated user or unknown object safely
 */
export function getUserRole(user: unknown): UserRole | null {
  if (isAuthenticatedUser(user)) {
    return user.role;
  }
  // Fallback for legacy code
  if (typeof user === 'object' && user !== null && 'role' in user) {
    const role = (user as any).role;
    if (typeof role === 'string' && isValidRole(role)) {
      return role as UserRole;
    }
  }
  return null;
}

/**
 * Check if a string is a valid user role
 */
export function isValidRole(role: string): role is UserRole {
  return ['member', 'arb', 'board', 'arb_board', 'admin'].includes(role.toLowerCase());
}
