/**
 * Idempotent run of schema-vendors-show-on-public.sql.
 * If vendors already has "show_on_public" (duplicate column), exit 0.
 * Usage: node scripts/run-vendors-show-on-public.js [--local|--remote]
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const isLocal = process.argv.includes('--local');
const args = [
  'd1', 'execute', 'clrhoa_db',
  isLocal ? '--local' : '--remote',
  '--file=./scripts/schema-vendors-show-on-public.sql',
];

const result = spawnSync('npx', ['wrangler', ...args], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});

const stderr = (result.stderr || '') + (result.stdout || '');
const isDuplicateColumn = /duplicate column name:\s*show_on_public/i.test(stderr);

if (result.status === 0) {
  process.exit(0);
}
if (isDuplicateColumn) {
  console.log('vendors.show_on_public already exists; migration already applied.');
  process.exit(0);
}
console.error(stderr);
process.exit(result.status ?? 1);
