/**
 * Example test showing how to use storageState for authentication.
 *
 * This approach is much simpler than the old programmatic session creation.
 */

import { test, expect } from '@playwright/test';
import { AUTH_FILES } from '../setup/auth.setup.js';

// Example 1: Test with member authentication
test.describe('Member Dashboard', () => {
  // Use storageState to load pre-authenticated session
  test.use({ storageState: AUTH_FILES.member });

  test('member can access dashboard', async ({ page }) => {
    await page.goto('/portal/dashboard');

    // Should be logged in and see dashboard
    await expect(page).toHaveURL(/\/portal\/dashboard/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('member can view profile', async ({ page }) => {
    await page.goto('/portal/profile');

    await expect(page).toHaveURL(/\/portal\/profile/);
    await expect(page.locator('text=My Profile')).toBeVisible();
  });
});

// Example 2: Test with admin authentication
test.describe('Admin Access', () => {
  // Use admin storageState
  test.use({ storageState: AUTH_FILES.admin });

  test('admin can access admin portal', async ({ page }) => {
    await page.goto('/portal/admin');

    // Should be able to access admin section
    await expect(page).toHaveURL(/\/portal\/admin/);
  });
});

// Example 3: Test with board authentication
test.describe('Board Features', () => {
  test.use({ storageState: AUTH_FILES.board });

  test('board can access board features', async ({ page }) => {
    await page.goto('/portal/dashboard');

    // Board users have access to board-specific features
    await expect(page).toHaveURL(/\/portal\/dashboard/);
  });
});

// Example 4: Test without authentication (public pages)
test.describe('Public Pages', () => {
  // No storageState = unauthenticated

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/portal/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('can access public documents', async ({ page }) => {
    await page.goto('/documents');

    // Should be able to view public documents
    await expect(page).toHaveURL(/\/documents/);
  });
});
