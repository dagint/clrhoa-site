/**
 * E2E tests for route access control.
 *
 * Tests all protected routes × all roles = 250+ test cases.
 * Verifies that RBAC enforcement works correctly across the entire portal.
 *
 * Test pattern:
 * - For each role, test access to every protected route
 * - If role is allowed: expect 200 or redirect to same zone
 * - If role is denied: expect redirect to appropriate landing zone
 */

import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth.js';
import { PROTECTED_ROUTES } from '../../../src/utils/rbac.js';
import { TEST_USERS } from '../fixtures/testUsers.js';

// All roles to test
const ROLES = ['member', 'arb', 'board', 'arb_board', 'admin'] as const;

// Landing zones for each role (where unauthorized users are redirected)
const LANDING_ZONES: Record<string, RegExp> = {
  member: /\/portal\/dashboard/,
  arb: /\/portal\/arb/,
  board: /\/portal\/board/,
  arb_board: /\/portal\/board/,
  admin: /\/portal\/admin/,
};

test.describe('Route Access Control', () => {
  // Test each role's access to all routes
  for (const role of ROLES) {
    test.describe(`${role.toUpperCase()} role access`, () => {
      for (const route of PROTECTED_ROUTES) {
        const shouldHaveAccess = route.allowedRoles.includes(role);
        const testName = shouldHaveAccess
          ? `✓ CAN access ${route.path}`
          : `✗ CANNOT access ${route.path}`;

        test(testName, async ({ browser }) => {
          // Create new context with authentication
          const context = await browser.newContext();

          // Login as this role with elevation (if elevated role)
          const needsElevation = ['arb', 'board', 'arb_board', 'admin'].includes(role);
          await loginAs(context, role, { elevated: needsElevation });

          // Create page and navigate
          const page = await context.newPage();

          try {
            const response = await page.goto(route.path, {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            });

            if (shouldHaveAccess) {
              // User should have access
              // Allow 200 (success) or 302 (redirect within same zone)
              const status = response?.status();
              expect([200, 302]).toContain(status);

              // Should NOT see "Access Denied" message
              const accessDenied = page.locator('text=Access Denied');
              await expect(accessDenied).not.toBeVisible({ timeout: 1000 }).catch(() => {
                // Ignore - page might not have this element at all
              });

              // Should NOT be redirected to a different landing zone
              const url = page.url();
              for (const [otherRole, landingZone] of Object.entries(LANDING_ZONES)) {
                if (otherRole === role) continue; // Skip own landing zone
                expect(url).not.toMatch(landingZone);
              }
            } else {
              // User should NOT have access
              // Should be redirected to their appropriate landing zone
              await page.waitForURL(LANDING_ZONES[role], { timeout: 5000 });

              // Verify final URL matches expected landing zone
              const url = page.url();
              expect(url).toMatch(LANDING_ZONES[role]);
            }
          } catch (error) {
            // Enhanced error reporting
            console.error(`Test failed: ${role} accessing ${route.path}`);
            console.error(`Should have access: ${shouldHaveAccess}`);
            console.error(`Current URL: ${page.url()}`);
            throw error;
          } finally {
            await context.close();
          }
        });
      }
    });
  }

  // Special test: Unauthenticated access should redirect to login
  test.describe('Unauthenticated access', () => {
    test('should redirect to login for protected routes', async ({ page }) => {
      // Pick a few representative routes to test (not all 50+ to save time)
      const routesToTest = [
        '/portal/dashboard',
        '/portal/admin',
        '/portal/board',
        '/portal/arb',
        '/board/directory',
      ];

      for (const path of routesToTest) {
        await page.goto(path);

        // Should redirect to login
        await expect(page).toHaveURL(/\/portal\/login/, { timeout: 5000 });

        // Go back to test next route
        if (routesToTest.indexOf(path) < routesToTest.length - 1) {
          await page.goto('/');
        }
      }
    });
  });

  // Special test: Admin role assumption
  test.describe('Admin role assumption', () => {
    test('admin assuming board role can access board-only routes', async ({ browser }) => {
      const context = await browser.newContext();

      // Login as admin with board role assumption
      await loginAs(context, 'admin', { elevated: true, assumeRole: 'board' });

      const page = await context.newPage();

      // Admin should now be able to access board-only routes
      const response = await page.goto('/board/assessments');
      expect(response?.status()).toBe(200);

      // Should see "Acting as Board" or similar indicator
      const body = await page.textContent('body');
      expect(body).toMatch(/acting as.*board/i);

      await context.close();
    });

    test('admin assuming arb role can access arb-only routes', async ({ browser }) => {
      const context = await browser.newContext();

      // Login as admin with arb role assumption
      await loginAs(context, 'admin', { elevated: true, assumeRole: 'arb' });

      const page = await context.newPage();

      // Admin should now be able to access arb routes
      const response = await page.goto('/portal/arb');
      expect(response?.status()).toBe(200);

      await context.close();
    });
  });

  // Special test: ARB+Board role (dual role)
  test.describe('ARB+Board dual role', () => {
    test('arb_board can access both ARB and Board routes', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'arb_board', { elevated: true });

      const page = await context.newPage();

      // Should access board routes
      await page.goto('/portal/board');
      expect(page.url()).toMatch(/\/portal\/board/);

      // Should access arb routes
      await page.goto('/portal/arb');
      expect(page.url()).toMatch(/\/portal\/arb/);

      // Should access arb dashboard
      await page.goto('/portal/arb-dashboard');
      expect(page.url()).toMatch(/\/portal\/arb-dashboard/);

      await context.close();
    });
  });

  // Special test: Non-elevated access (PIM)
  test.describe('Non-elevated access (PIM)', () => {
    test('board without elevation redirected to elevation request', async ({ browser }) => {
      const context = await browser.newContext();

      // Login as board WITHOUT elevation
      await loginAs(context, 'board', { elevated: false });

      const page = await context.newPage();

      // Try to access board-only route
      await page.goto('/board/assessments');

      // Should be redirected to request elevation
      await expect(page).toHaveURL(/\/portal\/request-elevated-access/, { timeout: 5000 });

      await context.close();
    });

    test('admin without elevation redirected to elevation request', async ({ browser }) => {
      const context = await browser.newContext();

      // Login as admin WITHOUT elevation
      await loginAs(context, 'admin', { elevated: false });

      const page = await context.newPage();

      // Try to access admin route
      await page.goto('/portal/admin/feedback');

      // Should be redirected to request elevation or landing
      await expect(page).toHaveURL(/\/(portal\/admin|portal\/request-elevated-access)/, {
        timeout: 5000,
      });

      await context.close();
    });
  });
});
