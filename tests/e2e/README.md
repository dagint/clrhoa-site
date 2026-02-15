# E2E Tests

End-to-end tests using Playwright for RBAC (role-based access control) validation.

## Running Tests Locally

E2E tests **must be run locally** before merging PRs. They are currently disabled in CI due to D1 instance isolation issues with Wrangler tooling.

### Prerequisites

1. Install dependencies: `npm ci`
2. Install Playwright browsers: `npx playwright install --with-deps chromium`
3. Build the application: `npm run build`

### Running Tests

**Terminal 1 - Start dev server:**
```bash
npm run preview:test
```

**Terminal 2 - Run tests:**
```bash
# Run all E2E tests
npm run test:e2e

# Run smoke tests only (faster)
npm run test:smoke

# Run specific test file
npx playwright test tests/e2e/rbac/route-access.spec.ts

# Run with UI mode (interactive)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Test Structure

- `setup/` - Global setup, auth setup, and teardown
- `helpers/` - Database and authentication helpers
- `fixtures/` - Test user data
- `rbac/` - Role-based access control tests
- `smoke/` - Quick smoke tests
- `examples/` - Example tests showing storageState pattern

### Authentication

Tests use Playwright's `storageState` feature for authentication:

1. `setup/auth.setup.ts` creates sessions for each role (member, board, arb, admin)
2. Session cookies are saved to `playwright/.auth/*.json`
3. Tests load these storageState files to start pre-authenticated

Example:
```typescript
import { test, expect } from '@playwright/test';
import { AUTH_FILES } from '../setup/auth-paths.js';

test.describe('Board Features', () => {
  test.use({ storageState: AUTH_FILES.board });

  test('board can access requests page', async ({ page }) => {
    await page.goto('/portal/requests');
    await expect(page).toHaveURL(/\/portal\/requests/);
  });
});
```

## Why Not Run in CI?

**Issue #107**: Wrangler has a D1 instance isolation problem where:
- `wrangler d1 execute --local` uses one D1 instance (`.wrangler/state/v3/d1/`)
- `wrangler pages dev --local` uses a **different** D1 instance
- Test setup seeds data to one instance, but the dev server reads from another
- Result: "no such table: sessions" errors

**Attempted Solutions:**
- Remote D1: `wrangler pages dev` doesn't support remote bindings well
- Shared local D1: No way to force both commands to use the same instance
- `wrangler dev`: Different issues, not compatible with Astro SSR setup

**Current Solution:**
- Skip E2E tests in CI (workflow runs on manual trigger only)
- Developers run tests locally before merging
- Focus on comprehensive unit/integration tests for CI

## Future Improvements

Once Wrangler tooling improves D1 instance management, we can re-enable CI testing. Monitor:
- https://github.com/cloudflare/workers-sdk/issues (Wrangler issues)
- Cloudflare Workers Discord for updates

Alternatively, we could:
- Test against deployed preview environments (slower, uses production resources)
- Switch to a different testing approach that doesn't require Wrangler dev server
- Use Docker to containerize the entire test environment
