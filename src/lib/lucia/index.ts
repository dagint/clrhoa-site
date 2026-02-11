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
 * @returns Configured Lucia instance
 */
export function createLucia(db: D1Database) {
  const adapter = new D1Adapter(db, {
    user: 'users',
    session: 'sessions',
  });

  return new Lucia(adapter, {
    sessionCookie: {
      name: 'clrhoa_lucia_session',
      expires: false, // Session cookies (expires when browser closes)
      attributes: {
        secure: true, // HTTPS only in production
        sameSite: 'lax', // CSRF protection
        path: '/',
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
