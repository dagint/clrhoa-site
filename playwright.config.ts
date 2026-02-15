import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

/**
 * Playwright configuration for E2E RBAC testing.
 *
 * Tests run against a local wrangler dev server with --local flag for ephemeral D1/KV.
 * Authentication uses real session cookie signing from src/lib/auth.ts.
 *
 * Run tests:
 *   npm run test:e2e              - Run all E2E tests
 *   npm run test:e2e:ui           - Run tests in interactive UI mode
 *   npm run test:e2e:debug        - Run tests in debug mode
 *   npm run test:e2e:chromium     - Run tests in Chromium only
 */

// Load test environment variables
dotenv.config({ path: '.env.test' });

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Maximum time one test can run (30 seconds)
  timeout: 30 * 1000,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI only (helps with flaky tests)
  retries: process.env.CI ? 2 : 0,

  // Number of parallel workers
  // Use fewer workers on CI to avoid resource contention
  workers: process.env.CI ? 2 : undefined,

  // Run tests in parallel
  fullyParallel: true,

  // Reporter configuration
  reporter: [
    // Terminal output (always)
    ['list'],
    // HTML report (always generated, can view with: npx playwright show-report)
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    // JSON report for CI artifact storage
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Global setup and teardown
  globalSetup: './tests/e2e/setup/global-setup.ts',
  globalTeardown: './tests/e2e/setup/global-teardown.ts',

  // Shared settings for all projects
  use: {
    // Base URL for all tests (use 127.0.0.1 to match wrangler dev output)
    baseURL: process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788',

    // Collect trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Ignore HTTPS errors (local dev server)
    ignoreHTTPSErrors: true,

    // Timeout for each action (10 seconds)
    actionTimeout: 10 * 1000,

    // Timeout for navigation (15 seconds)
    navigationTimeout: 15 * 1000,
  },

  // Configure projects for major browsers
  projects: [
    // Setup project - runs first to create authenticated sessions
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Main test project - depends on setup
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // Commented out - install with: npx playwright install firefox webkit
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    //   dependencies: ['setup'],
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    //   dependencies: ['setup'],
    // },

    // Mobile browsers (optional, comment out for faster test runs)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    //   dependencies: ['setup'],
    // },
  ],

  // Run local dev server before starting tests
  // Note: You should start wrangler dev server manually with:
  //   npm run preview:test
  //
  // We don't use webServer here because wrangler dev needs special flags
  // and the D1/KV bindings need to be set up correctly.
  //
  // webServer: {
  //   command: 'npm run preview:test',
  //   url: 'http://localhost:8788',
  //   timeout: 120 * 1000,
  //   reuseExistingServer: !process.env.CI,
  // },
});
