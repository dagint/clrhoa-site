/**
 * Simplified authentication helpers using Playwright storageState.
 *
 * These helpers use pre-authenticated sessions created by auth.setup.ts.
 * This approach is faster and more reliable than creating sessions programmatically.
 */

import { type BrowserContext, type Page } from '@playwright/test';
import { AUTH_FILES } from '../setup/auth.setup.js';

/**
 * Get the storageState file path for a given role.
 *
 * @param role - User role ('member', 'board', 'arb', 'arb_board', 'admin')
 * @returns Path to the storageState JSON file
 */
export function getAuthFile(role: string): string {
  const authFile = AUTH_FILES[role as keyof typeof AUTH_FILES];
  if (!authFile) {
    throw new Error(`No auth file found for role: ${role}`);
  }
  return authFile;
}

/**
 * Check if a page has a valid session cookie.
 *
 * @param page - Playwright page
 * @returns True if session cookie exists
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => cookie.name === 'clrhoa_session');
}

/**
 * Logout by clearing all cookies.
 *
 * @param context - Playwright browser context
 */
export async function logout(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Get session cookie value from page.
 *
 * @param page - Playwright page
 * @returns Session cookie value or null if not found
 */
export async function getSessionCookieValue(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === 'clrhoa_session');
  return sessionCookie?.value ?? null;
}
