/**
 * Smoke tests for critical user paths.
 *
 * Quick tests (< 5 minutes) to verify core functionality.
 * Run these on every commit; full E2E suite on PR only.
 *
 * Critical paths:
 * - Login and authentication
 * - Landing zone redirects
 * - Key route access per role
 * - Menu visibility basics
 */

import { test, expect } from '@playwright/test';
import { loginAs, isAuthenticated } from '../helpers/auth.js';

test.describe('Smoke Tests - Critical Paths', () => {
  test('member can login and access dashboard', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, 'member');
    const page = await context.newPage();

    // Verify authenticated
    expect(await isAuthenticated(page)).toBe(true);

    // Can access protected area (dashboard or profile if required)
    await page.goto('/portal/dashboard');

    // Should NOT be on login page (means we're authenticated)
    await expect(page).not.toHaveURL(/\/portal\/login/);

    // Should be in portal area (dashboard or profile completion)
    await expect(page).toHaveURL(/\/portal\//);

    await context.close();
  });

  test('board can access board directory with elevation', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, 'board', { elevated: true });
    const page = await context.newPage();

    // Can access board directory
    await page.goto('/board/directory');
    await expect(page).toHaveURL(/\/board\/directory/);

    await context.close();
  });

  test('admin can access admin panel', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, 'admin', { elevated: true });
    const page = await context.newPage();

    // Can access admin panel
    await page.goto('/portal/admin');
    await expect(page).toHaveURL(/\/portal\/admin/);

    await context.close();
  });

  test('arb can access arb dashboard', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, 'arb', { elevated: true });
    const page = await context.newPage();

    // Can access ARB dashboard
    await page.goto('/portal/arb-dashboard');
    await expect(page).toHaveURL(/\/portal\/arb-dashboard/);

    await context.close();
  });

  test('unauthorized access redirects correctly', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, 'member');
    const page = await context.newPage();

    // Member tries to access admin panel
    await page.goto('/portal/admin');

    // Should redirect to member dashboard
    await expect(page).toHaveURL(/\/portal\/dashboard/, { timeout: 5000 });

    await context.close();
  });

  test('unauthenticated user redirects to login', async ({ page }) => {
    // No authentication
    await page.goto('/portal/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/portal\/login/, { timeout: 5000 });
  });

  test('admin can assume board role', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, 'admin', { elevated: true, assumeRole: 'board' });
    const page = await context.newPage();

    // Should access board route
    await page.goto('/board/assessments');
    await expect(page).toHaveURL(/\/board\/assessments/);

    // Should show role assumption indicator
    await expect(page.locator('text=/acting as.*board/i')).toBeVisible();

    await context.close();
  });

  test('menu visibility matches role permissions', async ({ browser }) => {
    // Test member
    const memberContext = await browser.newContext();
    await loginAs(memberContext, 'member');
    const memberPage = await memberContext.newPage();
    await memberPage.goto('/portal/dashboard');

    // Member should NOT see admin link (check count instead of visibility)
    await expect(memberPage.locator('nav').locator('text=Admin')).toHaveCount(0);
    await memberContext.close();

    // Test admin
    const adminContext = await browser.newContext();
    await loginAs(adminContext, 'admin', { elevated: true });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/portal/admin');

    // Admin SHOULD see admin link (check that at least one exists)
    await expect(adminPage.getByRole('link', { name: 'Admin' })).toBeVisible();
    await adminContext.close();
  });

  test('board without elevation redirects to elevation request', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, 'board', { elevated: false });
    const page = await context.newPage();

    // Try to access board route
    await page.goto('/board/assessments');

    // Should redirect to elevation request
    await expect(page).toHaveURL(/\/portal\/request-elevated-access/, { timeout: 5000 });

    await context.close();
  });

  test('all roles can access profile page', async ({ browser }) => {
    const roles = ['member', 'admin', 'board', 'arb', 'arb_board'];

    for (const role of roles) {
      const context = await browser.newContext();
      const needsElevation = role !== 'member';
      await loginAs(context, role, { elevated: needsElevation });
      const page = await context.newPage();

      await page.goto('/portal/profile');
      await expect(page).toHaveURL(/\/portal\/profile/);

      await context.close();
    }
  });
});
