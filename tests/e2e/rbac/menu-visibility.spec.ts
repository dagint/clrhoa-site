/**
 * E2E tests for menu visibility based on role.
 *
 * Verifies that navigation menus correctly show/hide links based on user permissions.
 * This ensures UI matches backend RBAC enforcement.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth.js';

test.describe('Menu Visibility', () => {
  test.describe('Member role navigation', () => {
    test('should see only member-accessible menu items', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'member');
      const page = await context.newPage();

      await page.goto('/portal/dashboard');

      // Should see member items
      await expect(page.locator('a[href="/portal/dashboard"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/directory"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/documents"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/profile"]')).toBeVisible();

      // Should NOT see admin items
      await expect(page.locator('a[href="/portal/admin"]')).not.toBeVisible();
      await expect(page.locator('a[href="/portal/admin/feedback"]')).not.toBeVisible();

      // Should NOT see board items
      await expect(page.locator('a[href="/portal/board"]')).not.toBeVisible();
      await expect(page.locator('a[href="/board/directory"]')).not.toBeVisible();

      // Should NOT see ARB items
      await expect(page.locator('a[href="/portal/arb"]')).not.toBeVisible();
      await expect(page.locator('a[href="/portal/arb-dashboard"]')).not.toBeVisible();

      await context.close();
    });
  });

  test.describe('Board role navigation', () => {
    test('should see board menu items but not admin items', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'board', { elevated: true });
      const page = await context.newPage();

      await page.goto('/portal/board');

      // Should see board items
      await expect(page.locator('a[href="/portal/board"]')).toBeVisible();
      await expect(page.locator('a[href="/board/directory"]')).toBeVisible();
      await expect(page.locator('a[href="/board/assessments"]')).toBeVisible();

      // Should see member items (board has member access)
      await expect(page.locator('a[href="/portal/dashboard"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/directory"]')).toBeVisible();

      // Should NOT see admin items
      await expect(page.locator('a[href="/portal/admin"]')).not.toBeVisible();
      await expect(page.locator('a[href="/portal/admin/feedback"]')).not.toBeVisible();
      await expect(page.locator('a[href="/portal/admin/usage"]')).not.toBeVisible();

      // Should NOT see ARB-only items (board sees arb-dashboard but can't act)
      // ARB dashboard is view-only for board
      const arbDashboard = page.locator('a[href="/portal/arb-dashboard"]');
      if (await arbDashboard.isVisible()) {
        // If visible, verify it's marked as view-only or read-only
        const text = await arbDashboard.textContent();
        expect(text?.toLowerCase()).toMatch(/(view|read)/);
      }

      await context.close();
    });
  });

  test.describe('ARB role navigation', () => {
    test('should see ARB menu items', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'arb', { elevated: true });
      const page = await context.newPage();

      await page.goto('/portal/arb');

      // Should see ARB items
      await expect(page.locator('a[href="/portal/arb"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/arb-dashboard"]')).toBeVisible();

      // Should see member items (ARB has member access)
      await expect(page.locator('a[href="/portal/dashboard"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/directory"]')).toBeVisible();

      // Should NOT see admin items
      await expect(page.locator('a[href="/portal/admin"]')).not.toBeVisible();

      // Should NOT see board-only items (like board assessments)
      await expect(page.locator('a[href="/board/assessments"]')).not.toBeVisible();

      await context.close();
    });
  });

  test.describe('ARB+Board dual role navigation', () => {
    test('should see both ARB and Board menu items', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'arb_board', { elevated: true });
      const page = await context.newPage();

      await page.goto('/portal/board');

      // Should see board items
      await expect(page.locator('a[href="/portal/board"]')).toBeVisible();
      await expect(page.locator('a[href="/board/directory"]')).toBeVisible();

      // Should see ARB items
      await expect(page.locator('a[href="/portal/arb"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/arb-dashboard"]')).toBeVisible();

      // Should NOT see admin items
      await expect(page.locator('a[href="/portal/admin"]')).not.toBeVisible();
      await expect(page.locator('a[href="/portal/admin/feedback"]')).not.toBeVisible();

      await context.close();
    });
  });

  test.describe('Admin role navigation', () => {
    test('should see admin menu items only', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'admin', { elevated: true });
      const page = await context.newPage();

      await page.goto('/portal/admin');

      // Should see admin items
      await expect(page.locator('a[href="/portal/admin"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/admin/feedback"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/admin/usage"]')).toBeVisible();
      await expect(page.locator('a[href="/portal/admin/audit-logs"]')).toBeVisible();

      // Should see member items (admin has member access)
      await expect(page.locator('a[href="/portal/dashboard"]')).toBeVisible();

      // Should NOT see board-only items (unless assuming board role)
      await expect(page.locator('a[href="/board/assessments"]')).not.toBeVisible();

      // Should NOT see ARB-only items (unless assuming arb role)
      // Note: arb-dashboard might be visible as read-only, but ARB landing should not be
      await expect(page.locator('a[href="/portal/arb"]')).not.toBeVisible();

      await context.close();
    });

    test('admin assuming board role should see board items', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'admin', { elevated: true, assumeRole: 'board' });
      const page = await context.newPage();

      await page.goto('/portal/board');

      // Should see board items now
      await expect(page.locator('a[href="/portal/board"]')).toBeVisible();
      await expect(page.locator('a[href="/board/directory"]')).toBeVisible();
      await expect(page.locator('a[href="/board/assessments"]')).toBeVisible();

      // Should see "Acting as Board" indicator
      await expect(page.locator('text=/acting as.*board/i')).toBeVisible();

      // Should still see admin link (to drop assumed role)
      await expect(page.locator('a[href="/portal/admin"]')).toBeVisible();

      await context.close();
    });
  });

  test.describe('Elevation indicator visibility', () => {
    test('elevated roles should show elevation status', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'board', { elevated: true });
      const page = await context.newPage();

      await page.goto('/portal/board');

      // Should show elevation indicator (e.g., "Elevated Access" badge)
      const elevatedIndicator = page.locator('text=/elevated|privileged/i');
      await expect(elevatedIndicator).toBeVisible();

      await context.close();
    });

    test('non-elevated roles should not show elevation status', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'member');
      const page = await context.newPage();

      await page.goto('/portal/dashboard');

      // Should NOT show elevation indicator
      const elevatedIndicator = page.locator('text=/elevated|privileged/i');
      await expect(elevatedIndicator).not.toBeVisible();

      await context.close();
    });
  });

  test.describe('Profile menu', () => {
    test('all roles should see profile link', async ({ browser }) => {
      const roles = ['member', 'arb', 'board', 'arb_board', 'admin'];

      for (const role of roles) {
        const context = await browser.newContext();
        const needsElevation = role !== 'member';
        await loginAs(context, role, { elevated: needsElevation });
        const page = await context.newPage();

        await page.goto('/portal/dashboard');

        // Should see profile link
        await expect(page.locator('a[href="/portal/profile"]')).toBeVisible();

        // Should see logout button/link
        const logout = page.locator('button:has-text("Logout"), a:has-text("Logout")');
        await expect(logout).toBeVisible();

        await context.close();
      }
    });
  });
});
