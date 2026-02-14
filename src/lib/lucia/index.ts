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
 * Determine if we're running in production based on environment.
 * Checks common environment indicators.
 */
function isProductionEnvironment(url?: string): boolean {
  // Check Node.js NODE_ENV (if available in serverless context)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return true;
  }

  // If a URL is provided, check if it's a production domain
  if (url) {
    const hostname = new URL(url).hostname;
    // Development indicators: localhost, 127.0.0.1, .local, or Astro preview ports
    const isDev = hostname.includes('localhost') ||
                  hostname.includes('127.0.0.1') ||
                  hostname.includes('.local') ||
                  hostname.includes(':4321') || // Astro default dev port
                  hostname.includes(':3000');
    return !isDev;
  }

  // Default to production (safer)
  return true;
}

/**
 * Create Lucia instance configured for D1 database.
 *
 * @param db - D1 database instance
 * @param urlOrIsProduction - URL string to detect environment, or boolean for explicit production mode (default: true)
 * @returns Configured Lucia instance
 */
export function createLucia(db: D1Database, urlOrIsProduction?: string | boolean) {
  const adapter = new D1Adapter(db, {
    user: 'users',
    session: 'sessions',
  });

  // Determine production mode
  let isProduction: boolean;
  if (typeof urlOrIsProduction === 'boolean') {
    isProduction = urlOrIsProduction;
  } else if (typeof urlOrIsProduction === 'string') {
    isProduction = isProductionEnvironment(urlOrIsProduction);
  } else {
    isProduction = true; // Default to production (safer)
  }

  // Use secure cookies in production, allow insecure in development
  // This is more reliable than hostname-based detection
  const isSecure = isProduction;

  return new Lucia(adapter, {
    sessionCookie: {
      name: 'clrhoa_session',
      expires: false, // Session cookies (expires when browser closes)
      attributes: {
        secure: isSecure, // HTTPS only in production, HTTP in development
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
