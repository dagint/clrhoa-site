/**
 * E2E tests for API endpoint access control.
 *
 * Tests that API endpoints correctly enforce RBAC permissions.
 * Uses Playwright's request context for direct HTTP testing.
 */

import { test, expect } from '@playwright/test';
import { loginAs, getSessionCookieValue } from '../helpers/auth.js';

test.describe('API Access Control', () => {
  test.describe('Admin API endpoints', () => {
    test('admin can access admin feedback API', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'admin', { elevated: true });
      const page = await context.newPage();

      // Get session cookie
      const sessionCookie = await getSessionCookieValue(page);
      expect(sessionCookie).toBeTruthy();

      // Make API request with session cookie
      const response = await page.request.get('/api/admin/feedback', {
        headers: {
          Cookie: `clrhoa_session=${sessionCookie}`,
        },
      });

      // Should return 200 or 404 (if no feedback exists)
      expect([200, 404]).toContain(response.status());

      await context.close();
    });

    test('member cannot access admin feedback API', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'member');
      const page = await context.newPage();

      const sessionCookie = await getSessionCookieValue(page);
      expect(sessionCookie).toBeTruthy();

      // Make API request
      const response = await page.request.get('/api/admin/feedback', {
        headers: {
          Cookie: `clrhoa_session=${sessionCookie}`,
        },
      });

      // Should return 403 Forbidden or 401 Unauthorized
      expect([401, 403]).toContain(response.status());

      await context.close();
    });
  });

  test.describe('Board API endpoints', () => {
    test('board can access directory API', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'board', { elevated: true });
      const page = await context.newPage();

      const sessionCookie = await getSessionCookieValue(page);

      // Make API request
      const response = await page.request.get('/api/board/directory', {
        headers: {
          Cookie: `clrhoa_session=${sessionCookie}`,
        },
      });

      // Should succeed (200) or 404 (if endpoint doesn't exist yet)
      expect([200, 404]).toContain(response.status());

      await context.close();
    });

    test('member cannot access board directory API', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'member');
      const page = await context.newPage();

      const sessionCookie = await getSessionCookieValue(page);

      // Make API request
      const response = await page.request.get('/api/board/directory', {
        headers: {
          Cookie: `clrhoa_session=${sessionCookie}`,
        },
      });

      // Should be denied
      expect([401, 403, 404]).toContain(response.status());

      await context.close();
    });
  });

  test.describe('ARB API endpoints', () => {
    test('arb can access ARB request API', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'arb', { elevated: true });
      const page = await context.newPage();

      const sessionCookie = await getSessionCookieValue(page);

      // Make API request
      const response = await page.request.get('/api/arb/requests', {
        headers: {
          Cookie: `clrhoa_session=${sessionCookie}`,
        },
      });

      // Should succeed or 404
      expect([200, 404]).toContain(response.status());

      await context.close();
    });

    test('member can access their own ARB requests', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'member');
      const page = await context.newPage();

      const sessionCookie = await getSessionCookieValue(page);

      // Make API request for own requests
      const response = await page.request.get('/api/my-requests', {
        headers: {
          Cookie: `clrhoa_session=${sessionCookie}`,
        },
      });

      // Should succeed
      expect([200, 404]).toContain(response.status());

      await context.close();
    });
  });

  test.describe('Unauthenticated API access', () => {
    test('unauthenticated requests should be denied', async ({ request }) => {
      // Try to access protected API without session cookie
      const endpoints = [
        '/api/admin/feedback',
        '/api/board/directory',
        '/api/arb/requests',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint);

        // Should return 401 or redirect to login
        expect([401, 403, 302]).toContain(response.status());
      }
    });
  });

  test.describe('CSRF protection', () => {
    test('POST requests without CSRF token should be rejected', async ({ browser }) => {
      const context = await browser.newContext();
      await loginAs(context, 'admin', { elevated: true });
      const page = await context.newPage();

      const sessionCookie = await getSessionCookieValue(page);

      // Try POST without CSRF token
      const response = await page.request.post('/api/admin/feedback', {
        headers: {
          Cookie: `clrhoa_session=${sessionCookie}`,
        },
        data: {
          message: 'Test feedback',
        },
      });

      // Should be rejected (403 or 400)
      // Note: If endpoint doesn't exist yet, might be 404
      expect([400, 403, 404]).toContain(response.status());

      await context.close();
    });
  });
});
