/**
 * Test user fixtures for E2E RBAC testing.
 *
 * These users are seeded into D1 and KV before tests run and cleaned up after.
 * Each user represents one of the 5 roles in the CLRHOA system.
 */

export interface TestUser {
  email: string;
  role: 'member' | 'admin' | 'board' | 'arb' | 'arb_board';
  name: string;
  address: string;
  phone: string;
}

/**
 * Test user definitions (one per role).
 *
 * IMPORTANT: All test emails use @clrhoa.test domain to avoid conflicts with real users.
 * These users are automatically seeded and cleaned up by global setup/teardown.
 */
export const TEST_USERS: Record<string, TestUser> = {
  member: {
    email: 'test-member@clrhoa.test',
    role: 'member',
    name: 'Test Member',
    address: '123 Test Lane',
    phone: '555-0101',
  },

  arb: {
    email: 'test-arb@clrhoa.test',
    role: 'arb',
    name: 'Test ARB Committee',
    address: '456 ARB Street',
    phone: '555-0102',
  },

  board: {
    email: 'test-board@clrhoa.test',
    role: 'board',
    name: 'Test Board Member',
    address: '789 Board Avenue',
    phone: '555-0103',
  },

  arb_board: {
    email: 'test-arb-board@clrhoa.test',
    role: 'arb_board',
    name: 'Test ARB & Board',
    address: '321 Dual Role Drive',
    phone: '555-0104',
  },

  admin: {
    email: 'test-admin@clrhoa.test',
    role: 'admin',
    name: 'Test Administrator',
    address: '654 Admin Way',
    phone: '555-0105',
  },
};

/**
 * Get all test users as an array.
 */
export function getAllTestUsers(): TestUser[] {
  return Object.values(TEST_USERS);
}

/**
 * Get test user by role.
 */
export function getTestUser(role: string): TestUser | undefined {
  return TEST_USERS[role];
}

/**
 * Check if an email belongs to a test user.
 */
export function isTestUser(email: string): boolean {
  return email.endsWith('@clrhoa.test');
}
