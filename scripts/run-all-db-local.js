#!/usr/bin/env node
/**
 * Run all D1 local migrations in dependency order.
 * Use before `npm run dev` to ensure the local DB has all tables.
 * Usage: node scripts/run-all-db-local.js   OR   npm run db:local:all
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// SQLite/D1 errors that mean "migration already applied" — safe to skip and continue
const ALREADY_APPLIED = [
  /duplicate column name/i,
  /table .* already exists/i,
  /column .* already exists/i,
];

function run(name, file) {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'clrhoa_db', '--local', '--file', path.join(root, 'scripts', file)],
    { cwd: root, encoding: 'utf8', shell: true }
  );
  const output = (result.stdout || '') + (result.stderr || '');
  if (result.status === 0) {
    if (output.trim()) console.log(output.trim());
    return;
  }
  const alreadyApplied = ALREADY_APPLIED.some((re) => re.test(output));
  if (alreadyApplied) {
    console.log(`  (${name} already applied, skipping)`);
    return;
  }
  console.error(output);
  console.error(`\nFailed: ${name} (${file})`);
  process.exit(result.status ?? 1);
}

function runScript(name, scriptArgs) {
  const result = spawnSync('node', [path.join(root, 'scripts', scriptArgs[0]), ...scriptArgs.slice(1)], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`\nFailed: ${name}`);
    process.exit(result.status ?? 1);
  }
}

console.log('Running all local D1 migrations in order...\n');

run('db:init', 'schema.sql');
run('db:arb:init', 'schema-arb.sql');
run('db:arb:migrate v2', 'schema-arb-v2-add-fields.sql');
run('db:arb:migrate v3', 'schema-arb-v3-updated-at.sql');
run('db:arb:migrate v4', 'schema-arb-v4-copy.sql');
run('db:arb:migrate v5', 'schema-arb-v5-revision-notes.sql');
run('db:arb:migrate v6', 'schema-arb-v6-notes.sql');
run('db:arb:migrate v7', 'schema-arb-v7-deadline.sql');
run('db:arb:migrate v8', 'schema-arb-v8-retention.sql');
run('db:arb:audit', 'schema-arb-audit.sql');
run('db:phase3', 'schema-phase3.sql');
run('db:vendor-submissions', 'schema-vendor-submissions.sql');
run('db:owners-phones', 'schema-owners-phones.sql');
runScript('db:vendors-website', ['run-vendors-website-migration.js', '--local']);
run('db:vendor-submissions-website', 'schema-vendor-submissions-website.sql');
run('db:directory-logs-email', 'schema-directory-logs-email.sql');
run('db:directory-logs-viewer-role', 'schema-directory-logs-viewer-role.sql');
run('db:owners-audit-contact', 'schema-owners-audit-contact.sql');
run('db:owners-created-at', 'schema-owners-created-at.sql');
run('db:phase4', 'schema-phase4.sql');
run('db:phase35', 'schema-phase35-users-notifications.sql');
run('db:phase35-notification-types', 'schema-phase35-notification-types.sql');
run('db:phase5', 'schema-phase5.sql');
run('db:phase5-paid-through', 'schema-phase5-paid-through.sql');
run('db:phase5-special-assessments', 'schema-phase5-special-assessments.sql');
run('db:phase6', 'schema-phase6-preapproval.sql');
run('db:login-history', 'schema-login-history.sql');
run('db:public-documents', 'schema-public-documents.sql');
run('db:member-documents', 'schema-member-documents.sql');
run('db:backup-config', 'schema-backup-config.sql');
run('db:assessment-recorded-by', 'schema-assessment-payments-recorded-by.sql');
run('db:owners-primary', 'schema-owners-primary.sql');

console.log('\nAll local DB migrations completed. You can run npm run dev.');
process.exit(0);
