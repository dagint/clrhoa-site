/**
 * Storage state file paths for authenticated sessions.
 * Used by tests to load pre-authenticated user sessions.
 */

import path from 'path';

const STORAGE_STATE_DIR = path.join(process.cwd(), 'playwright/.auth');

export const AUTH_FILES = {
  member: path.join(STORAGE_STATE_DIR, 'member.json'),
  board: path.join(STORAGE_STATE_DIR, 'board.json'),
  arb: path.join(STORAGE_STATE_DIR, 'arb.json'),
  arb_board: path.join(STORAGE_STATE_DIR, 'arb_board.json'),
  admin: path.join(STORAGE_STATE_DIR, 'admin.json'),
};
