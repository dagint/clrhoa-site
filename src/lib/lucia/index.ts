/**
 * Lucia Authentication Setup
 *
 * Configures Lucia v3 for session-based authentication.
 * Uses D1 adapter for session storage.
 *
 * Reference: https://lucia-auth.com/
 */

import { Lucia } from 'lucia';
import { D1Adapter } from '@lucia-auth/adapter-sqlite';

export interface DatabaseUserAttributes {
  email: string;
  role: string;
  status: string;
}

/**
 * Create Lucia instance configured for D1 database.
 *
 * @param db - D1 database instance
 * @param hostname - Optional hostname for cookie domain configuration
 * @returns Configured Lucia instance
 */
export function createLucia(db: D1Database, hostname?: string) {
  const adapter = new D1Adapter(db, {
    user: 'users',
    session: 'sessions',
  });

  // Determine if we're in a secure context (HTTPS)
  // For localhost/development, allow insecure cookies
  const isLocalhost = hostname?.includes('localhost') || hostname?.includes('127.0.0.1') || hostname?.includes('.local');
  const isSecure = !isLocalhost;

  return new Lucia(adapter, {
    sessionCookie: {
      name: 'clrhoa_session',
      expires: false, // Session cookies (expires when browser closes)
      attributes: {
        secure: isSecure, // HTTPS only in production, HTTP for localhost
        sameSite: 'lax', // CSRF protection
        path: '/',
        // Don't set domain - let it default to current hostname
        // This avoids subdomain issues while maintaining security
      },
    },
    getUserAttributes: (attributes) => {
      return {
        email: attributes.email,
        role: attributes.role,
        status: attributes.status,
      };
    },
  });
}

declare module 'lucia' {
  interface Register {
    Lucia: ReturnType<typeof createLucia>;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}
