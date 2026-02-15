# E2E RBAC Testing

End-to-end tests for the CLRHOA HOA Portal's role-based access control (RBAC) system using Playwright.

## Overview

These tests verify that the RBAC system correctly enforces permissions across:
- **50+ protected routes** across 5 roles (member, arb, board, arb_board, admin)
- **Session management** with PIM (Privileged Identity Management) elevation
- **Role assumption** for admin and arb_board users
- **Menu visibility** based on user permissions
- **API endpoint** access control

**Why E2E tests matter:**
- Catch RBAC regressions before deployment
- Verify permission changes take effect immediately
- Test complex flows (PIM elevation, admin role assumption)
- Ensure UI matches backend permissions
- Provide confidence for auth/permission refactoring

## Test Coverage

- ✅ **250+ route access tests** (all routes × all roles)
- ✅ **Menu visibility tests** (navigation rendering per role)
- ✅ **PIM elevation tests** (2-hour elevation windows)
- ✅ **Role assumption tests** (admin/arb_board switching)
- ✅ **Smoke tests** (critical paths, < 5 minutes)

## Prerequisites

1. **Node.js 20+** (current: v23.9.0)
2. **Wrangler CLI** installed globally or via npm
3. **Playwright browsers** installed (`npx playwright install`)
4. **Built application** (`npm run build`)
5. **Local D1/KV setup** (wrangler --local)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install --with-deps chromium
```

For all browsers (chromium, firefox, webkit):
```bash
npx playwright install --with-deps
```

### 3. Configure Environment

The `.env.test` file is gitignored and contains test-specific configuration:

```bash
# .env.test (auto-loaded by Playwright)
SESSION_SECRET=test-secret-key-for-e2e-testing-only
PUBLIC_SITE_URL=http://localhost:8788
NODE_ENV=test
NOTIFY_BOARD_EMAIL=test-board@clrhoa.test
NOTIFY_ARB_EMAIL=test-arb@clrhoa.test
```

### 4. Build Application

```bash
npm run build
```

### 5. Start Test Server

In a separate terminal, start the wrangler dev server with --local flag:

```bash
npm run preview:test
```

This runs: `wrangler pages dev ./dist --local --port=8788`

The `--local` flag uses ephemeral D1/KV storage for tests (no persistent data).

## Running Tests

### Full Test Suite

```bash
npm run test:e2e
```

### Interactive UI Mode

```bash
npm run test:e2e:ui
```

### Debug Mode

```bash
npm run test:e2e:debug
```

### Headed Mode (watch browser)

```bash
npm run test:e2e:headed
```

### Specific Browser

```bash
npm run test:e2e:chromium
```

### Smoke Tests Only

```bash
npm run test:smoke
```

### View Test Report

```bash
npm run test:e2e:report
```

## Test Structure

```
tests/e2e/
├── fixtures/
│   ├── testUsers.ts          # Test user definitions (5 roles)
│   └── routes.ts             # Re-export PROTECTED_ROUTES
├── helpers/
│   ├── auth-new.ts           # storageState helpers (current)
│   ├── auth.ts               # DEPRECATED - old session creation
│   └── database.ts           # seedTestUsers(), cleanupTestUsers()
├── rbac/
│   ├── route-access.spec.ts  # 250+ route access tests
│   └── menu-visibility.spec.ts # Menu rendering per role
├── smoke/
│   └── critical-paths.spec.ts # Quick smoke tests (5 min)
├── examples/
│   └── auth-example.spec.ts  # storageState usage examples
└── setup/
    ├── auth.setup.ts         # Create authenticated sessions (NEW)
    ├── global-setup.ts       # Seed test data before all tests
    └── global-teardown.ts    # Cleanup after all tests
```

## Writing Tests

> **Note:** We use Playwright's `storageState` feature for authentication. See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for details.

### Basic Authentication Test

```typescript
import { test, expect } from '@playwright/test';
import { AUTH_FILES } from './setup/auth.setup.js';

test.describe('Member Dashboard', () => {
  // Load pre-authenticated session
  test.use({ storageState: AUTH_FILES.member });

  test('member can access dashboard', async ({ page }) => {
    // Already logged in!
    await page.goto('/portal/dashboard');
    await expect(page).toHaveURL(/\/portal\/dashboard/);
  });
});
```

### Testing Multiple Roles

```typescript
import { AUTH_FILES } from './setup/auth.setup.js';

test.describe('Board Features', () => {
  test.use({ storageState: AUTH_FILES.board });

  test('board can access board directory', async ({ page }) => {
    await page.goto('/board/directory');
    await expect(page).toHaveURL(/\/board\/directory/);
  });
});

test.describe('Admin Features', () => {
  test.use({ storageState: AUTH_FILES.admin });

  test('admin can access admin panel', async ({ page }) => {
    await page.goto('/portal/admin');
    await expect(page).toHaveURL(/\/portal\/admin/);
  });
});
```

### Testing Unauthenticated Access

```typescript
test.describe('Public Pages', () => {
  // No storageState = unauthenticated

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/portal/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
```

## Test Data

### Test Users

Test users are automatically seeded before tests and cleaned up after:

| Role       | Email                       | Name                  |
|------------|-----------------------------|-----------------------|
| member     | test-member@clrhoa.test     | Test Member           |
| arb        | test-arb@clrhoa.test        | Test ARB Committee    |
| board      | test-board@clrhoa.test      | Test Board Member     |
| arb_board  | test-arb-board@clrhoa.test  | Test ARB & Board      |
| admin      | test-admin@clrhoa.test      | Test Administrator    |

All test emails use `@clrhoa.test` domain to avoid conflicts with real users.

### Test Data Lifecycle

1. **Global Setup** (`global-setup.ts`):
   - Seed test users to D1 and KV
   - Reset permissions to defaults
   - Verify database connectivity

2. **Tests Run**: Use test users for authentication

3. **Global Teardown** (`global-teardown.ts`):
   - Remove test users from D1 and KV
   - Clean up test artifacts

## Debugging

### Visual Debugging

Run tests in headed mode to watch browser:

```bash
npm run test:e2e:headed
```

### Debug Mode

Step through tests with Playwright Inspector:

```bash
npm run test:e2e:debug
```

### Screenshots and Videos

Failed tests automatically capture:
- Screenshot on failure
- Video on failure (saved to `test-results/`)

### Verbose Logging

Enable debug logging:

```bash
DEBUG=pw:api npm run test:e2e
```

### View Test Traces

Traces are captured on first retry:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

## CI/CD Integration

Tests run on every PR via GitHub Actions.

### GitHub Actions Workflow

```yaml
- name: Build application
  run: npm run build

- name: Install Playwright Browsers
  run: npx playwright install --with-deps chromium

- name: Start wrangler dev server
  run: npm run preview:test &

- name: Wait for server
  run: sleep 10

- name: Run E2E tests
  run: npm run test:e2e
  env:
    SESSION_SECRET: ${{ secrets.SESSION_SECRET_TEST }}

- name: Upload Playwright report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

### Required GitHub Secrets

- `SESSION_SECRET_TEST` - Test session secret (generate with `openssl rand -hex 32`)

## Troubleshooting

### Server not running

**Error**: `getaddrinfo ECONNREFUSED localhost:8788`

**Solution**: Start the test server first:
```bash
npm run preview:test
```

### Test users not found

**Error**: `Test user not found for role: member`

**Solution**: Verify global setup ran successfully. Check `global-setup.ts` logs.

### Session secret missing

**Error**: `SESSION_SECRET environment variable is not set`

**Solution**: Create `.env.test` file with valid `SESSION_SECRET`.

### Wrangler local database missing

**Error**: `Users table not found in D1 database`

**Solution**: Initialize D1 schema locally:
```bash
npm run db:init:local
npm run db:route-permissions:local
```

### Timeout errors

**Error**: `Timeout 30000ms exceeded`

**Solution**:
- Increase timeout in `playwright.config.ts`
- Check if server is responding: `curl http://localhost:8788`
- Verify D1/KV bindings are working

### Flaky tests

**Problem**: Tests pass sometimes, fail other times

**Solution**:
- Add explicit waits: `await page.waitForURL(...)`
- Use `waitUntil: 'domcontentloaded'` for faster page loads
- Check for race conditions in navigation
- Enable retries on CI (already configured: `retries: 2`)

## Best Practices

### ✅ Do

- Use `storageState` for authentication (see examples above)
- Group related tests with `test.describe()`
- Use specific selectors (`a[href="/portal/admin"]`)
- Test both positive and negative cases
- Use descriptive test names
- Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for authentication patterns

### ❌ Don't

- Create sessions programmatically in tests (use `storageState` instead)
- Call `loginAs()` or `createTestSession()` (deprecated - see migration guide)
- Use vague selectors (`text=Link`)
- Test implementation details (test behavior, not code structure)
- Skip the setup project (auth states won't be created)

## Performance

- **Full suite**: ~10 minutes (250+ tests)
- **Smoke tests**: ~5 minutes (10 tests)
- **Parallelization**: Tests run in parallel (up to 4 workers)
- **Browser reuse**: Playwright reuses browsers across tests

### Optimization Tips

1. Run smoke tests on every commit
2. Run full suite on PR only
3. Use `--project=chromium` for faster local testing
4. Comment out mobile browsers in `playwright.config.ts`

## Maintenance

### When adding new routes

1. Add route to `PROTECTED_ROUTES` in `src/utils/rbac.ts`
2. E2E tests automatically include the new route (no test updates needed)

### When adding new roles

1. Add to `VALID_ROLES` in `src/lib/auth.ts`
2. Add test user to `fixtures/testUsers.ts`
3. Update `seedTestUsers()` in `helpers/database.ts`
4. E2E tests automatically test the new role

### When modifying permissions logic

1. Run full E2E suite: `npm run test:e2e`
2. Review failures - they indicate breaking changes
3. Update tests if behavior change is intentional

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [CLRHOA RBAC System](../../src/utils/rbac.ts)
- [Authentication Implementation](../../src/lib/auth.ts)
- [Project CLAUDE.md](../../CLAUDE.md)

## Support

For issues or questions:
1. Check this README
2. Review test logs: `playwright-report/index.html`
3. Enable debug mode: `npm run test:e2e:debug`
4. Check GitHub Issues: https://github.com/anthropics/claude-code/issues
