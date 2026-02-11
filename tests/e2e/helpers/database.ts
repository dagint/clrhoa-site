/**
 * Database helpers for E2E test data seeding and cleanup.
 *
 * Uses wrangler CLI with --local flag for ephemeral D1 and KV storage.
 * All test data is isolated and cleaned up automatically.
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getAllTestUsers, isTestUser } from '../fixtures/testUsers.js';

/**
 * Execute wrangler D1 command with --local flag.
 *
 * Uses temporary file approach for cross-platform compatibility (Windows/Linux/Mac).
 *
 * @param sql - SQL command to execute
 * @param dbName - Database name (defaults to clrhoa_db)
 * @returns Command output
 */
function executeD1Command(sql: string, dbName: string = 'clrhoa_db'): string {
  const tmpFile = join(process.cwd(), `.tmp-sql-${Date.now()}.sql`);

  try {
    // Write SQL to temporary file
    writeFileSync(tmpFile, sql, 'utf-8');

    // Execute using --file flag (cross-platform compatible)
    const command = `wrangler d1 execute ${dbName} --local --file="${tmpFile}"`;
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    return output;
  } catch (error) {
    console.error(`[database] D1 command failed: ${sql}`);
    if (error instanceof Error) {
      console.error(`[database] Error: ${error.message}`);
    }
    throw error;
  } finally {
    // Clean up temporary file
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Execute wrangler KV command.
 *
 * NOTE: For local testing with `wrangler dev --local`, KV state is managed
 * by the dev server, not CLI commands. We'll seed KV via SQL instead.
 *
 * @param action - KV action (put, get, delete, list)
 * @param key - KV key
 * @param value - KV value (for put action)
 * @param namespace - KV namespace ID (defaults to CLOURHOA_USERS)
 * @returns Command output
 */
function executeKVCommand(
  action: 'put' | 'get' | 'delete' | 'list',
  key?: string,
  value?: string,
  namespace: string = 'CLOURHOA_USERS'
): string {
  // For local E2E tests, KV is managed by wrangler dev server
  // We don't need to seed KV via CLI - authentication will work via D1 users table
  console.log(`[database] KV ${action} skipped (using wrangler dev server's KV instance)`);
  return '';
}

/**
 * Seed test users into D1 users and owners tables.
 *
 * This function is called by global-setup.ts before tests run.
 * Test users are inserted with test-specific emails (@clrhoa.test domain).
 *
 * NOTE: We only seed D1, not KV. E2E tests create session cookies directly
 * using createSessionCookieValue(), bypassing the login flow that checks KV.
 */
export async function seedTestUsers(): Promise<void> {
  console.log('[database] Seeding test users...');

  const testUsers = getAllTestUsers();

  for (const user of testUsers) {
    try {
      // Insert into D1 users table
      const insertUserSQL = `
        INSERT OR REPLACE INTO users (email, role, name, phone, sms_optin)
        VALUES (
          '${user.email}',
          '${user.role}',
          '${user.name}',
          '${user.phone}',
          0
        )
      `;

      executeD1Command(insertUserSQL);

      // Insert into D1 owners table (required for profile completion)
      const ownerId = `test-owner-${user.role}`;
      const insertOwnerSQL = `
        INSERT OR REPLACE INTO owners (
          id, name, address, phone, email,
          share_contact_with_members, is_primary, lot_number,
          created_by_email, created_at
        )
        VALUES (
          '${ownerId}',
          '${user.name}',
          '${user.address}',
          '${user.phone}',
          '${user.email}',
          1,
          1,
          'LOT-${user.role.toUpperCase()}',
          'test-admin@clrhoa.test',
          datetime('now')
        )
      `;

      executeD1Command(insertOwnerSQL);

      console.log(`[database] ✓ Seeded user: ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`[database] ✗ Failed to seed user: ${user.email}`);
      throw error;
    }
  }

  console.log(`[database] Successfully seeded ${testUsers.length} test users`);
}

/**
 * Clean up test users from D1 users and owners tables.
 *
 * This function is called by global-teardown.ts after tests complete.
 * Only removes users with @clrhoa.test emails for safety.
 *
 * NOTE: We only clean D1, not KV. KV state is ephemeral in wrangler dev --local.
 */
export async function cleanupTestUsers(): Promise<void> {
  console.log('[database] Cleaning up test users...');

  const testUsers = getAllTestUsers();

  for (const user of testUsers) {
    try {
      // Verify it's a test user before deletion (safety check)
      if (!isTestUser(user.email)) {
        console.warn(`[database] Skipping non-test user: ${user.email}`);
        continue;
      }

      // Delete from D1 users table
      const deleteUserSQL = `DELETE FROM users WHERE email = '${user.email}'`;
      executeD1Command(deleteUserSQL);

      // Delete from D1 owners table
      const deleteOwnerSQL = `DELETE FROM owners WHERE email = '${user.email}'`;
      executeD1Command(deleteOwnerSQL);

      console.log(`[database] ✓ Cleaned up user: ${user.email}`);
    } catch (error) {
      console.error(`[database] ✗ Failed to clean up user: ${user.email}`);
      // Continue cleanup even if one fails
    }
  }

  console.log('[database] Test user cleanup complete');
}

/**
 * Reset route permissions to defaults (delete all from route_permissions table).
 *
 * This ensures tests start with a clean state using PROTECTED_ROUTES defaults.
 * Called by global-setup.ts before tests run.
 */
export async function resetPermissions(): Promise<void> {
  console.log('[database] Resetting route permissions to defaults...');

  try {
    const deleteSQL = 'DELETE FROM route_permissions';
    executeD1Command(deleteSQL);

    console.log('[database] ✓ Route permissions reset successfully');
  } catch (error) {
    console.error('[database] ✗ Failed to reset permissions');
    throw error;
  }
}

/**
 * Clean up all test data (convenience function).
 *
 * Calls all cleanup functions in the correct order.
 */
export async function cleanupTestData(): Promise<void> {
  console.log('[database] Starting full test data cleanup...');

  await cleanupTestUsers();
  await resetPermissions();

  console.log('[database] Full test data cleanup complete');
}

/**
 * Verify database connectivity and tables exist.
 *
 * Throws if D1 database is not accessible or required tables are missing.
 */
export async function verifyDatabaseSetup(): Promise<void> {
  console.log('[database] Verifying database setup...');

  try {
    // Check if users table exists
    const checkUsersSQL = "SELECT name FROM sqlite_master WHERE type='table' AND name='users'";
    const usersResult = executeD1Command(checkUsersSQL);

    if (!usersResult.includes('users')) {
      throw new Error('Users table not found in D1 database');
    }

    // Check if route_permissions table exists
    const checkPermissionsSQL = "SELECT name FROM sqlite_master WHERE type='table' AND name='route_permissions'";
    const permissionsResult = executeD1Command(checkPermissionsSQL);

    if (!permissionsResult.includes('route_permissions')) {
      console.warn('[database] Warning: route_permissions table not found (permission tests may fail)');
    }

    console.log('[database] ✓ Database setup verified');
  } catch (error) {
    console.error('[database] ✗ Database verification failed');
    throw error;
  }
}
