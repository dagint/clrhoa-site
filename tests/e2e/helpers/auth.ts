/**
 * Authentication helpers for E2E tests.
 *
 * Provides utilities to programmatically authenticate as any role using Lucia sessions.
 * Creates actual database sessions for authentic testing.
 */

import { type BrowserContext, type Page } from '@playwright/test';
import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/middleware.js';
import { TEST_USERS, type TestUser } from '../fixtures/testUsers.js';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PIM_ELEVATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ASSUMED_ROLE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Generate a Lucia-compatible session ID (40-character hex string).
 */
function generateSessionId(): string {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Execute wrangler D1 command with --local flag.
 */
function executeD1Command(sql: string, dbName: string = 'clrhoa_db'): void {
  const tmpFile = join(process.cwd(), `.tmp-sql-${Date.now()}.sql`);

  try {
    writeFileSync(tmpFile, sql, 'utf-8');
    execSync(`npx wrangler d1 execute ${dbName} --local --file="${tmpFile}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error(`[auth] D1 command failed: ${sql}`);
    throw error;
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Options for creating a test session.
 */
export interface SessionOptions {
  /** Whether to pre-elevate the session (for elevated roles: board, arb, arb_board, admin) */
  elevated?: boolean;
  /** For admin/arb_board: which role to assume (board or arb) */
  assumeRole?: 'board' | 'arb';
}

/**
 * Create a Lucia session in the D1 database for a test user.
 *
 * Inserts a session row into the sessions table with appropriate PIM/role assumption settings.
 *
 * @param user - Test user to create session for
 * @param options - Session options (elevation, role assumption, etc.)
 * @returns Lucia session ID
 */
export async function createTestSession(
  user: TestUser,
  options: SessionOptions = {}
): Promise<string> {
  const { elevated = false, assumeRole } = options;
  const sessionId = generateSessionId();
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_MS;

  // Convert timestamps to Unix seconds for SQLite INTEGER storage
  const expiresAtUnix = Math.floor(expiresAt / 1000);
  const createdAtUnix = Math.floor(now / 1000);

  // Build session attributes
  const elevatedRoles = ['arb', 'board', 'arb_board', 'admin'];
  const shouldElevate = elevated && elevatedRoles.includes(user.role);
  const elevatedUntil = shouldElevate ? now + PIM_ELEVATION_TTL_MS : null;

  const shouldAssumeRole = assumeRole && (user.role === 'admin' || user.role === 'arb_board');
  const assumedAt = shouldAssumeRole ? now : null;
  const assumedUntil = shouldAssumeRole ? now + ASSUMED_ROLE_TTL_MS : null;

  // Insert session into D1
  // Format dates for SQLite DATETIME type (ISO8601 format)
  const expiresAtISO = new Date(expiresAt).toISOString();
  const createdAtISO = new Date(now).toISOString();

  const sql = `
    INSERT INTO sessions (
      id,
      user_id,
      expires_at,
      created_at,
      last_activity,
      ip_address,
      user_agent,
      fingerprint,
      is_active,
      elevated_until,
      assumed_role,
      assumed_at,
      assumed_until
    ) VALUES (
      '${sessionId}',
      '${user.email}',
      '${expiresAtISO}',
      '${createdAtISO}',
      '${createdAtISO}',
      '127.0.0.1',
      'Playwright-Test',
      'test-fingerprint',
      1,
      ${elevatedUntil},
      ${assumeRole ? `'${assumeRole}'` : 'NULL'},
      ${assumedAt},
      ${assumedUntil}
    )
  `;

  executeD1Command(sql);
  return sessionId;
}

/**
 * Set Lucia session cookie in browser context.
 *
 * @param context - Playwright browser context
 * @param sessionId - Lucia session ID
 * @param baseURL - Base URL (defaults to PUBLIC_SITE_URL from env or http://127.0.0.1:8788)
 */
export async function setSessionCookie(
  context: BrowserContext,
  sessionId: string,
  baseURL?: string
): Promise<void> {
  const url = new URL(baseURL || process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788');

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionId,
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
 * Creates a Lucia session in the D1 database and sets the session cookie.
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

  const sessionId = await createTestSession(user, options);
  await setSessionCookie(context, sessionId);
}

/**
 * Logout by clearing session cookie.
 *
 * Note: This does NOT delete the session from the database. Sessions will be
 * cleaned up by global-teardown.ts after all tests complete.
 *
 * @param context - Playwright browser context
 */
export async function logout(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Clean up all test sessions from the database.
 *
 * Called by global-teardown.ts to remove all sessions for test users.
 */
export async function cleanupTestSessions(): Promise<void> {
  console.log('[auth] Cleaning up test sessions...');

  const testUsers = Object.values(TEST_USERS);

  for (const user of testUsers) {
    try {
      const sql = `DELETE FROM sessions WHERE user_id = '${user.email}'`;
      executeD1Command(sql);
      console.log(`[auth] ✓ Cleaned up sessions for: ${user.email}`);
    } catch (error) {
      console.error(`[auth] ✗ Failed to clean up sessions for: ${user.email}`);
      // Continue cleanup even if one fails
    }
  }

  console.log('[auth] Test session cleanup complete');
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
