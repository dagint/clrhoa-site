/**
 * Playwright authentication setup.
 *
 * Creates authenticated sessions for each role by:
 * 1. Using the test API endpoint to create Lucia sessions
 * 2. Manually constructing storageState files with session cookies
 * 3. Saving to files for reuse across tests
 *
 * This approach avoids login form issues and works reliably in CI.
 */

import { test as setup } from '@playwright/test';
import { TEST_USERS } from '../fixtures/testUsers.js';
import path from 'path';
import fs from 'fs';

const STORAGE_STATE_DIR = path.join(process.cwd(), 'playwright/.auth');

// Storage state file paths for each role
export const AUTH_FILES = {
  member: path.join(STORAGE_STATE_DIR, 'member.json'),
  board: path.join(STORAGE_STATE_DIR, 'board.json'),
  arb: path.join(STORAGE_STATE_DIR, 'arb.json'),
  arb_board: path.join(STORAGE_STATE_DIR, 'arb_board.json'),
  admin: path.join(STORAGE_STATE_DIR, 'admin.json'),
};

/**
 * Create a session via the test API endpoint and build storageState.
 */
async function createStorageState(
  email: string,
  role: string,
  baseURL: string,
  filePath: string
) {
  // Call test API to create session
  const response = await fetch(`${baseURL}/api/test/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: email }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create session for ${role}: ${response.status} - ${error}`);
  }

  const { sessionId } = await response.json() as { sessionId: string };

  // Parse URL to get domain
  const url = new URL(baseURL);
  const isSecure = url.protocol === 'https:';

  // Build storageState JSON manually
  const storageState = {
    cookies: [
      {
        name: 'clrhoa_session',
        value: sessionId,
        domain: url.hostname,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: isSecure,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };

  // Ensure directory exists
  if (!fs.existsSync(STORAGE_STATE_DIR)) {
    fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2));

  console.log(`✓ Saved ${role} auth state to ${filePath} (session: ${sessionId.substring(0, 10)}...)`);
}

// Setup authenticated session for member role
setup('authenticate as member', async () => {
  const user = TEST_USERS.member;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await createStorageState(user.email, 'member', baseURL, AUTH_FILES.member);
});

// Setup authenticated session for board role
setup('authenticate as board', async () => {
  const user = TEST_USERS.board;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await createStorageState(user.email, 'board', baseURL, AUTH_FILES.board);
});

// Setup authenticated session for ARB role
setup('authenticate as arb', async () => {
  const user = TEST_USERS.arb;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await createStorageState(user.email, 'arb', baseURL, AUTH_FILES.arb);
});

// Setup authenticated session for ARB+Board role
setup('authenticate as arb_board', async () => {
  const user = TEST_USERS.arb_board;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await createStorageState(user.email, 'arb_board', baseURL, AUTH_FILES.arb_board);
});

// Setup authenticated session for admin role
setup('authenticate as admin', async () => {
  const user = TEST_USERS.admin;
  const baseURL = process.env.PUBLIC_SITE_URL || 'http://127.0.0.1:8788';

  await createStorageState(user.email, 'admin', baseURL, AUTH_FILES.admin);
});
