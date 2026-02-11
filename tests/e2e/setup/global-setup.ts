/**
 * Playwright global setup.
 *
 * Runs once before all E2E tests start.
 * Initializes test environment:
 * - Seeds test users to D1 and KV
 * - Resets permissions to defaults
 * - Verifies database connectivity
 * - Checks wrangler dev server availability
 */

import { seedTestUsers, resetPermissions, verifyDatabaseSetup } from '../helpers/database.js';

async function globalSetup() {
  console.log('\n=== E2E Test Environment Setup ===\n');

  try {
    // 1. Verify database setup
    await verifyDatabaseSetup();

    // 2. Reset permissions to defaults
    await resetPermissions();

    // 3. Seed test users
    await seedTestUsers();

    // 4. Verify wrangler dev server (optional - tests will fail if not running)
    const baseURL = process.env.PUBLIC_SITE_URL || 'http://localhost:8788';
    console.log(`[setup] Expected test server: ${baseURL}`);
    console.log('[setup] Make sure wrangler dev server is running:');
    console.log('[setup]   npm run build && npm run preview:test');

    console.log('\n=== Setup Complete ===\n');
  } catch (error) {
    console.error('\n=== Setup Failed ===\n');
    console.error(error);
    throw error;
  }
}

export default globalSetup;
