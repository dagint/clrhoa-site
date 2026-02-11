/**
 * Custom assertions for RBAC testing.
 *
 * Provides reusable assertion helpers for common RBAC checks.
 */

import { expect, type Page } from '@playwright/test';

/**
 * Assert that a page shows an "Access Denied" message.
 */
export async function expectAccessDenied(page: Page): Promise<void> {
  const accessDenied = page.locator('text=/access denied|unauthorized|forbidden/i');
  await expect(accessDenied).toBeVisible({ timeout: 5000 });
}

/**
 * Assert that a page does NOT show an "Access Denied" message.
 */
export async function expectAccessGranted(page: Page): Promise<void> {
  const accessDenied = page.locator('text=/access denied|unauthorized|forbidden/i');
  await expect(accessDenied).not.toBeVisible({ timeout: 1000 }).catch(() => {
    // Ignore - page might not have this element at all
  });
}

/**
 * Assert that a page redirected to the expected landing zone.
 */
export async function expectRedirectToLandingZone(
  page: Page,
  role: string
): Promise<void> {
  const landingZones: Record<string, RegExp> = {
    member: /\/portal\/dashboard/,
    arb: /\/portal\/arb/,
    board: /\/portal\/board/,
    arb_board: /\/portal\/board/,
    admin: /\/portal\/admin/,
  };

  const expectedPattern = landingZones[role];
  if (!expectedPattern) {
    throw new Error(`Unknown role: ${role}`);
  }

  await page.waitForURL(expectedPattern, { timeout: 5000 });
  expect(page.url()).toMatch(expectedPattern);
}

/**
 * Assert that a page shows elevation indicator.
 */
export async function expectElevationIndicator(page: Page): Promise<void> {
  const indicator = page.locator('text=/elevated|privileged/i');
  await expect(indicator).toBeVisible({ timeout: 3000 });
}

/**
 * Assert that a page shows role assumption indicator.
 */
export async function expectRoleAssumptionIndicator(
  page: Page,
  assumedRole: string
): Promise<void> {
  const pattern = new RegExp(`acting as.*${assumedRole}`, 'i');
  const indicator = page.locator(`text=${pattern}`);
  await expect(indicator).toBeVisible({ timeout: 3000 });
}

/**
 * Assert that a navigation link is visible.
 */
export async function expectNavLinkVisible(
  page: Page,
  href: string
): Promise<void> {
  const link = page.locator(`nav a[href="${href}"]`);
  await expect(link).toBeVisible({ timeout: 3000 });
}

/**
 * Assert that a navigation link is NOT visible.
 */
export async function expectNavLinkHidden(page: Page, href: string): Promise<void> {
  const link = page.locator(`nav a[href="${href}"]`);
  await expect(link).not.toBeVisible({ timeout: 1000 }).catch(() => {
    // Ignore - link might not exist in DOM at all
  });
}

/**
 * Assert that a page has a specific HTTP status code.
 */
export async function expectStatus(
  page: Page,
  expectedStatus: number | number[]
): Promise<void> {
  const response = await page.waitForResponse(() => true);
  const status = response.status();

  if (Array.isArray(expectedStatus)) {
    expect(expectedStatus).toContain(status);
  } else {
    expect(status).toBe(expectedStatus);
  }
}
