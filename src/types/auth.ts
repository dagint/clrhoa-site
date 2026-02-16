/**
 * Authentication Type Definitions
 *
 * Type-safe definitions for authenticated users and auth-related data structures.
 * Replaces usage of "any" types throughout the auth system.
 */

import type { Session, User } from 'lucia';

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

/**
 * PIM (Privileged Identity Management) session attributes
 *
 * These attributes are added to the session when a user elevates their privileges.
 * They track when elevation expires and what role is assumed (for multi-role users).
 */
export interface PIMAttributes {
  /** Timestamp (ms) when elevated access expires */
  elevated_until: number | null;

  /** For multi-role users (admin, arb_board): which specific role is currently assumed */
  assumed_role: string | null;

  /** Timestamp (ms) when role assumption started */
  assumed_at: number | null;

  /** Timestamp (ms) when role assumption expires */
  assumed_until: number | null;
}

/**
 * Extended Lucia session with custom attributes
 *
 * Lucia sessions are extended with:
 * - PIM attributes for privilege elevation tracking
 * - CSRF token for form security
 * - Base user role for permission checks
 */
export interface ExtendedSession extends Session, PIMAttributes {
  /** User's base role from the users table */
  role: UserRole;

  /** CSRF token for state-changing requests */
  csrfToken: string;
}

/**
 * Type guard to check if a session has PIM attributes
 */
export function hasPIMAttributes(session: Session | null | undefined): session is Session & PIMAttributes {
  if (!session) return false;
  return (
    'elevated_until' in session ||
    'assumed_role' in session ||
    'assumed_at' in session ||
    'assumed_until' in session
  );
}

/**
 * Type guard to check if a session is fully extended
 */
export function isExtendedSession(session: Session | null | undefined): session is ExtendedSession {
  if (!session) return false;
  return (
    'role' in session &&
    'csrfToken' in session &&
    hasPIMAttributes(session)
  );
}
