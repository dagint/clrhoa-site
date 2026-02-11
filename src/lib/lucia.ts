/**
 * Lucia Authentication Configuration
 *
 * Sets up Lucia v3 for session-based authentication with D1 database.
 *
 * Features:
 * - Session-based auth with 15-minute idle timeout (sliding window)
 * - D1 database adapter for session storage
 * - HttpOnly, Secure, SameSite cookies
 * - Type-safe user and session objects
 *
 * Usage:
 * ```typescript
 * import { lucia } from './lucia';
 *
 * // Create session
 * const session = await lucia.createSession(userId, {});
 * const sessionCookie = lucia.createSessionCookie(session.id);
 *
 * // Validate session
 * const { session, user } = await lucia.validateSession(sessionId);
 * ```
 *
 * @see https://lucia-auth.com/sessions/basic-api
 */

/// <reference types="@cloudflare/workers-types" />

import { Lucia, TimeSpan } from 'lucia';
import { D1Adapter } from '@lucia-auth/adapter-sqlite';

/**
 * User attributes stored in database and attached to session
 * Note: email is the userId, not an attribute
 */
export interface DatabaseUser {
  role: 'member' | 'arb' | 'board' | 'arb_board' | 'admin';
  name: string | null;
  status: 'pending_setup' | 'active' | 'inactive';
  mfa_enabled: boolean;
  created_at: string;
  last_login: string | null;
}

/**
 * Session attributes stored in database
 */
export interface DatabaseSession {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  last_activity: string;
  ip_address: string | null;
  user_agent: string | null;
  fingerprint: string | null;
  is_active: number;
}

/**
 * Create Lucia instance with D1 adapter
 *
 * @param db - Cloudflare D1 database instance
 * @returns Configured Lucia instance
 */
export function createLucia(db: D1Database) {
  const adapter = new D1Adapter(db, {
    user: 'users',
    session: 'sessions',
  });

  return new Lucia(adapter, {
    sessionCookie: {
      name: 'clrhoa_session',
      expires: false, // Session cookies (deleted on browser close)
      attributes: {
        secure: true, // HTTPS only in production
        sameSite: 'lax', // CSRF protection
        path: '/',
        // httpOnly is automatically set by Lucia
        // domain defaults to current domain
      },
    },
    sessionExpiresIn: new TimeSpan(15, 'm'), // 15 minute idle timeout (sliding window)
    getUserAttributes: (attributes) => {
      return {
        // Note: user.id will be the email (user_id from database)
        // email is the userId, so we don't duplicate it in attributes
        role: attributes.role,
        name: attributes.name,
        status: attributes.status,
        mfaEnabled: attributes.mfa_enabled,
        createdAt: attributes.created_at,
        lastLogin: attributes.last_login,
      };
    },
  });
}

/**
 * Type augmentation for Lucia
 * This makes TypeScript aware of custom user attributes
 */
declare module 'lucia' {
  interface Register {
    Lucia: ReturnType<typeof createLucia>;
    DatabaseUserAttributes: DatabaseUser;
  }
}

/**
 * Export Lucia type for use in other modules
 */
export type Auth = ReturnType<typeof createLucia>;
