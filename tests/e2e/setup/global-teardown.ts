/**
 * Playwright global teardown.
 *
 * Runs once after all E2E tests complete.
 * Cleans up test environment:
 * - Removes test users from D1 and KV
 * - Resets permissions
 * - Cleans up any test artifacts
 */

import { cleanupTestData } from '../helpers/database.js';

async function globalTeardown() {
  console.log('\n=== E2E Test Environment Teardown ===\n');

  try {
    // Clean up all test data
    await cleanupTestData();

    console.log('\n=== Teardown Complete ===\n');
  } catch (error) {
    console.error('\n=== Teardown Failed ===\n');
    console.error(error);
    // Don't throw - teardown failures shouldn't block test results
  }
}

export default globalTeardown;
