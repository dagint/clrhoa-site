/**
 * Playwright authentication setup.
 *
 * Creates authenticated sessions for each role by:
 * 1. Using the real login flow (tests actual authentication)
 * 2. Saving session cookies to storageState files
 * 3. Reusing these states across all tests (fast & reliable)
 *
 * This approach avoids D1 instance isolation issues with wrangler.
 */

import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/testUsers.js';
import path from 'path';

const STORAGE_STATE_DIR = path.join(process.cwd(), 'playwright/.auth');

// Storage state file paths for each role
export const AUTH_FILES = {
  member: path.join(STORAGE_STATE_DIR, 'member.json'),
  board: path.join(STORAGE_STATE_DIR, 'board.json'),
  arb: path.join(STORAGE_STATE_DIR, 'arb.json'),
  arb_board: path.join(STORAGE_STATE_DIR, 'arb_board.json'),
  admin: path.join(STORAGE_STATE_DIR, 'admin.json'),
};

/**
 * Login helper that uses the actual login flow.
 * This tests the real authentication system.
 */
async function loginWithCredentials(
  page: any,
  email: string,
  password: string,
  baseURL: string
) {
  await page.goto(`${baseURL}/auth/login`);

  // Fill in login form
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to portal (indicates successful login)
  await page.waitForURL(/\/portal/, { timeout: 10000 });

  // Verify we're logged in by checking for portal elements
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
}

// Setup authenticated session for member role
setup('authenticate as member', async ({ page }) => {
  const user = TEST_USERS.member;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await loginWithCredentials(page, user.email, user.password, baseURL);

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILES.member });

  console.log(`✓ Saved member auth state to ${AUTH_FILES.member}`);
});

// Setup authenticated session for board role
setup('authenticate as board', async ({ page }) => {
  const user = TEST_USERS.board;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await loginWithCredentials(page, user.email, user.password, baseURL);

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILES.board });

  console.log(`✓ Saved board auth state to ${AUTH_FILES.board}`);
});

// Setup authenticated session for ARB role
setup('authenticate as arb', async ({ page }) => {
  const user = TEST_USERS.arb;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await loginWithCredentials(page, user.email, user.password, baseURL);

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILES.arb });

  console.log(`✓ Saved arb auth state to ${AUTH_FILES.arb}`);
});

// Setup authenticated session for ARB+Board role
setup('authenticate as arb_board', async ({ page }) => {
  const user = TEST_USERS.arb_board;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await loginWithCredentials(page, user.email, user.password, baseURL);

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILES.arb_board });

  console.log(`✓ Saved arb_board auth state to ${AUTH_FILES.arb_board}`);
});

// Setup authenticated session for admin role
setup('authenticate as admin', async ({ page }) => {
  const user = TEST_USERS.admin;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await loginWithCredentials(page, user.email, user.password, baseURL);

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILES.admin });

  console.log(`✓ Saved admin auth state to ${AUTH_FILES.admin}`);
});
