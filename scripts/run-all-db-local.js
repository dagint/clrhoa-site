#!/usr/bin/env node
/**
 * Run all consolidated D1 schemas in order (local).
 * Usage: node scripts/run-all-db-local.js   OR   npm run db:local:all
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const schemas = [
  'schema-01-core.sql',
  'schema-02-auth-sessions.sql',
  'schema-03-features.sql',
  'schema-04-admin-compliance.sql',
  'schema-05-seed-data.sql',
];

console.log('Running all local D1 consolidated schemas...\n');

for (const schema of schemas) {
  console.log(`Executing ${schema}...`);
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'clrhoa_db', '--local', '--file', path.join(root, 'scripts', schema)],
    { cwd: root, stdio: 'inherit', shell: true }
  );
  if (result.status !== 0) {
    console.error(`\nFailed: ${schema}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n✓ All local DB schemas applied successfully.');
console.log('You can now run: npm run dev\n');
process.exit(0);
