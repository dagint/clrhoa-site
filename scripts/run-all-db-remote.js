#!/usr/bin/env node
/**
 * Run all consolidated D1 schemas in order (remote).
 * Usage: node scripts/run-all-db-remote.js   OR   npm run db:remote:all
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

console.log('Running all remote D1 consolidated schemas...\n');
console.log('⚠️  WARNING: This will execute on PRODUCTION database!');
console.log('   Press Ctrl+C within 5 seconds to cancel...\n');

// Give user time to cancel
await new Promise(resolve => setTimeout(resolve, 5000));

for (const schema of schemas) {
  console.log(`Executing ${schema}...`);
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'clrhoa_db', '--remote', '--file', path.join(root, 'scripts', schema)],
    { cwd: root, stdio: 'inherit', shell: true }
  );
  if (result.status !== 0) {
    console.error(`\nFailed: ${schema}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n✓ All remote DB schemas applied successfully.\n');
process.exit(0);
