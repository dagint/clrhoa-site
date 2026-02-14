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

/**
 * Execute wrangler D1 command with --local flag.
 * Used for cleanup operations.
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
 * Create a Lucia session via the test API endpoint.
 *
 * Uses the /api/test/create-session endpoint to create proper Lucia sessions
 * that will be validated correctly by the wrangler dev server.
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

  // Call the test API endpoint to create a session
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';
  const response = await fetch(`${baseURL}/api/test/create-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: user.email,
      elevated,
      assumeRole,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to create test session: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json() as { sessionId: string; expiresAt: number };
  return data.sessionId;
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
