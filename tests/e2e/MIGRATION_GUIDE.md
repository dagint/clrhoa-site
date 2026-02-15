# E2E Test Migration Guide: StorageState Authentication

## What Changed?

We've migrated from programmatic session creation to Playwright's `storageState` feature for authentication.

### Old Approach (❌ Deprecated)
```typescript
import { loginAs } from './helpers/auth.js';

test.describe('My Test', () => {
  test('test something', async ({ page, context }) => {
    // Create session programmatically
    await loginAs(context, 'member');
    await page.goto('/portal/dashboard');
    // ...
  });
});
```

**Problems:**
- Required D1 instance sharing between `wrangler d1 execute` and `wrangler pages dev`
- Slow (creates new session for each test)
- Fragile (D1 isolation issues in CI)

### New Approach (✅ Recommended)
```typescript
import { AUTH_FILES } from './setup/auth.setup.js';

test.describe('My Test', () => {
  // Load pre-authenticated session
  test.use({ storageState: AUTH_FILES.member });

  test('test something', async ({ page }) => {
    // Already logged in!
    await page.goto('/portal/dashboard');
    // ...
  });
});
```

**Benefits:**
- ✅ Fast (login once, reuse everywhere)
- ✅ Reliable (uses real login flow)
- ✅ No D1 instance issues
- ✅ Tests actual authentication system

## How to Migrate Your Tests

### Step 1: Import AUTH_FILES
```typescript
import { AUTH_FILES } from './setup/auth.setup.js';
```

### Step 2: Use storageState in test.describe()
```typescript
test.describe('My Test Suite', () => {
  // Set authentication for all tests in this suite
  test.use({ storageState: AUTH_FILES.member });

  test('my test', async ({ page }) => {
    // Already authenticated!
  });
});
```

### Step 3: Remove old auth helpers
Remove calls to:
- `loginAs(context, role)`
- `createTestSession(user, options)`
- `setSessionCookie(context, sessionId)`

### Available Roles
- `AUTH_FILES.member` - Regular member
- `AUTH_FILES.board` - Board member
- `AUTH_FILES.arb` - ARB member
- `AUTH_FILES.arb_board` - ARB + Board dual role
- `AUTH_FILES.admin` - Administrator

## Examples

### Testing as Member
```typescript
test.describe('Member Features', () => {
  test.use({ storageState: AUTH_FILES.member });

  test('can view profile', async ({ page }) => {
    await page.goto('/portal/profile');
    await expect(page).toHaveURL(/\/portal\/profile/);
  });
});
```

### Testing as Admin
```typescript
test.describe('Admin Features', () => {
  test.use({ storageState: AUTH_FILES.admin });

  test('can access admin panel', async ({ page }) => {
    await page.goto('/portal/admin');
    await expect(page).toHaveURL(/\/portal\/admin/);
  });
});
```

### Testing Unauthenticated
```typescript
test.describe('Public Pages', () => {
  // No test.use() = unauthenticated

  test('redirects to login', async ({ page }) => {
    await page.goto('/portal/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
```

### Testing Multiple Roles in One File
```typescript
test.describe('Dashboard Access', () => {
  test('member can access', async ({ page }) => {
    // Override storageState for this test only
    await context.addCookies(
      JSON.parse(fs.readFileSync(AUTH_FILES.member, 'utf-8')).cookies
    );
    await page.goto('/portal/dashboard');
    await expect(page).toHaveURL(/\/portal\/dashboard/);
  });

  test('admin can access', async ({ page }) => {
    await context.addCookies(
      JSON.parse(fs.readFileSync(AUTH_FILES.admin, 'utf-8')).cookies
    );
    await page.goto('/portal/dashboard');
    await expect(page).toHaveURL(/\/portal\/dashboard/);
  });
});

// Or use separate describe blocks (cleaner):
test.describe('Member Dashboard', () => {
  test.use({ storageState: AUTH_FILES.member });
  test('can access', async ({ page }) => { /* ... */ });
});

test.describe('Admin Dashboard', () => {
  test.use({ storageState: AUTH_FILES.admin });
  test('can access', async ({ page }) => { /* ... */ });
});
```

## How It Works

1. **Setup Phase** (`auth.setup.ts`)
   - Runs before all tests
   - Uses real login flow for each role
   - Saves session cookies to `playwright/.auth/*.json`

2. **Test Phase** (your tests)
   - `test.use({ storageState })` loads pre-authenticated cookies
   - All requests include the session cookie
   - No need to create sessions programmatically

3. **Performance**
   - Login happens once per role (5 total logins)
   - All tests reuse these sessions
   - Much faster than creating sessions per test

## Troubleshooting

### "Session expired" errors
The auth.setup.ts runs at the start of the test run. If your tests take longer than the session lifetime (7 days), sessions will expire.

**Solution:** Re-run tests to regenerate fresh sessions.

### "Cannot find auth file" errors
Make sure the setup project ran successfully:
```bash
npm run test:e2e -- --project=setup
```

Check that files exist:
```bash
ls -la playwright/.auth/
```

### Tests still failing
1. Verify test users exist in database (seeded by global-setup.ts)
2. Check wrangler dev server is running
3. Verify sessions table exists in local D1 database
4. Try regenerating auth states:
   ```bash
   rm -rf playwright/.auth
   npm run test:e2e -- --project=setup
   ```

## Migration Checklist

- [ ] Import `AUTH_FILES` from `./setup/auth.setup.js`
- [ ] Add `test.use({ storageState: AUTH_FILES.role })` to test suites
- [ ] Remove `loginAs()` calls
- [ ] Remove `createTestSession()` calls
- [ ] Remove `setSessionCookie()` calls
- [ ] Update test assertions (no more session creation overhead)
- [ ] Verify tests pass locally
- [ ] Verify tests pass in CI

## See Also

- `tests/e2e/examples/auth-example.spec.ts` - Working examples
- `tests/e2e/setup/auth.setup.ts` - Authentication setup
- [Playwright Auth Docs](https://playwright.dev/docs/auth)
