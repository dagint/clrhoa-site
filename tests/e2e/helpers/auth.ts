/**
 * Authentication helpers for E2E tests.
 *
 * Provides utilities to programmatically authenticate as any role using real session cookies.
 * Reuses the production `createSessionCookieValue()` function for authentic testing.
 */

import { type BrowserContext, type Page } from '@playwright/test';
import { SESSION_COOKIE_NAME, PIM_ELEVATION_TTL_MS, ASSUMED_ROLE_TTL_MS } from '../../../src/lib/auth.js';
import type { SessionPayload } from '../../../src/lib/auth.js';
import { TEST_USERS, type TestUser } from '../fixtures/testUsers.js';

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

/**
 * Generate a CSRF token.
 */
function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign payload with HMAC-SHA256 using SESSION_SECRET.
 */
async function signPayload(payload: SessionPayload, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const payloadB64 = btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payloadB64}.${sigB64}`;
}

/**
 * Options for creating a test session.
 */
export interface SessionOptions {
  /** Whether to pre-elevate the session (for elevated roles: board, arb, arb_board, admin) */
  elevated?: boolean;
  /** For admin/arb_board: which role to assume (board or arb) */
  assumeRole?: 'board' | 'arb';
  /** Custom expiration time (defaults to session max age) */
  expiresIn?: number;
}

/**
 * Get session secret from environment.
 * Throws if SESSION_SECRET is not set.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set. Check .env.test file.');
  }
  return secret;
}

/**
 * Create a signed session cookie value for a test user.
 *
 * Creates a legacy session WITHOUT fingerprint to avoid fingerprint mismatch
 * issues in E2E tests. Legacy sessions are still supported (grace period until 2026-05-10).
 *
 * @param user - Test user to create session for
 * @param options - Session options (elevation, role assumption, etc.)
 * @returns Signed session cookie value
 */
export async function createTestSession(
  user: TestUser,
  options: SessionOptions = {}
): Promise<string> {
  const { elevated = false, assumeRole } = options;
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);

  // Base session payload (WITHOUT fingerprint for E2E tests)
  const payload: SessionPayload = {
    email: user.email,
    role: user.role,
    name: user.name,
    exp: now + SESSION_MAX_AGE_SEC,
    csrfToken: generateCsrfToken(),
    lastActivity: now,
    sessionId: generateSessionId(),
    createdAt: now,
    // NO fingerprint - this makes it a legacy session that will be accepted
  };

  // Add elevation if requested and role is elevated
  const elevatedRoles = ['arb', 'board', 'arb_board', 'admin'];
  if (elevated && elevatedRoles.includes(user.role)) {
    payload.elevated_until = Date.now() + PIM_ELEVATION_TTL_MS;
  }

  // Add assumed role if requested (admin or arb_board only)
  if (assumeRole && (user.role === 'admin' || user.role === 'arb_board')) {
    payload.assumed_role = assumeRole;
    payload.assumed_at = Date.now();
    payload.assumed_until = Date.now() + ASSUMED_ROLE_TTL_MS;
  }

  // Sign the payload
  const sessionValue = await signPayload(payload, secret);
  return sessionValue;
}

/**
 * Set session cookie in browser context.
 *
 * @param context - Playwright browser context
 * @param sessionValue - Signed session cookie value
 * @param baseURL - Base URL (defaults to PUBLIC_SITE_URL from env or http://127.0.0.1:8788)
 */
export async function setSessionCookie(
  context: BrowserContext,
  sessionValue: string,
  baseURL?: string
): Promise<void> {
  const url = new URL(baseURL || process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788');

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionValue,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Login as a specific role in a browser context.
 *
 * Creates a new browser context with a session cookie for the specified role.
 * This is the primary authentication method for E2E tests.
 *
 * @param context - Playwright browser context
 * @param role - Role to login as ('member', 'admin', 'board', 'arb', 'arb_board')
 * @param options - Session options (elevation, role assumption, etc.)
 * @returns Promise that resolves when session is set
 *
 * @example
 * ```typescript
 * // Login as member (no elevation needed)
 * await loginAs(context, 'member');
 *
 * // Login as board with elevation
 * await loginAs(context, 'board', { elevated: true });
 *
 * // Login as admin assuming board role
 * await loginAs(context, 'admin', { elevated: true, assumeRole: 'board' });
 * ```
 */
export async function loginAs(
  context: BrowserContext,
  role: string,
  options: SessionOptions = {}
): Promise<void> {
  const user = TEST_USERS[role];
  if (!user) {
    throw new Error(`Test user not found for role: ${role}`);
  }

  const sessionValue = await createTestSession(user, options);
  await setSessionCookie(context, sessionValue);
}

/**
 * Logout by clearing session cookie.
 *
 * @param context - Playwright browser context
 */
export async function logout(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Check if a page has a valid session cookie.
 *
 * @param page - Playwright page
 * @returns True if session cookie exists
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => cookie.name === SESSION_COOKIE_NAME);
}

/**
 * Get session cookie value from page.
 *
 * @param page - Playwright page
 * @returns Session cookie value or null if not found
 */
export async function getSessionCookieValue(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
  return sessionCookie?.value ?? null;
}
