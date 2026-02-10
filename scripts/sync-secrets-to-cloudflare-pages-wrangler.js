#!/usr/bin/env node
/**
 * Sync GitHub Secrets to Cloudflare Pages using Wrangler CLI.
 * More reliable than direct API calls as Wrangler handles retries internally.
 *
 * Usage: node scripts/sync-secrets-to-cloudflare-pages-wrangler.js
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (or CLOUDFLARE_DEPLOY_API_TOKEN)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_SECRETS = ['SESSION_SECRET'];

const OPTIONAL_SECRETS = [
  'D1_DATABASE_ID',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'BACKUP_ENCRYPTION_KEY',
  'NOTIFY_BOARD_EMAIL',
  'NOTIFY_ARB_EMAIL',
  'NOTIFY_NOREPLY_EMAIL',
  'RESEND_API_KEY',
  'MAILCHANNELS_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'RECAPTCHA_SECRET_KEY',
];

const PROJECT_NAME = 'clrhoa-site';
const TEMP_SECRETS_FILE = path.join(process.cwd(), '.secrets.tmp.json');

/** When not in CI, load .env.local so running locally picks up vars. */
function loadEnvLocalIfNeeded() {
  if (process.env.CI === 'true') return;
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    if (!process.env[key]) process.env[key] = value;
  }
}

function cleanupTempFile() {
  try {
    if (fs.existsSync(TEMP_SECRETS_FILE)) {
      fs.unlinkSync(TEMP_SECRETS_FILE);
    }
  } catch {}
}

async function main() {
  loadEnvLocalIfNeeded();
  console.log('Syncing GitHub Secrets to Cloudflare Pages (using Wrangler CLI)\n');

  const token = process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error('Error: CLOUDFLARE_API_TOKEN or CLOUDFLARE_DEPLOY_API_TOKEN not set');
    process.exit(1);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    console.error('Error: CLOUDFLARE_ACCOUNT_ID not set');
    process.exit(1);
  }

  console.log(`Project: ${PROJECT_NAME}\n`);

  // Collect secrets to sync
  const secretsToSync = {};
  const setSecrets = [];
  const failed = [];
  const skipped = [];

  const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
  for (const name of allSecrets) {
    const value = process.env[name];
    if (!value || value.trim() === '' || value.trim() === 'SET_ME') {
      if (REQUIRED_SECRETS.includes(name)) {
        console.error(`⚠️  Required secret ${name} is not set`);
        failed.push(name);
      } else {
        skipped.push(name);
      }
      continue;
    }
    secretsToSync[name] = value;
    setSecrets.push(name);
  }

  if (failed.length > 0) {
    console.log('\n❌ Required secrets missing. Cannot proceed.');
    failed.forEach(s => console.log(`   - ${s}`));
    process.exit(1);
  }

  if (Object.keys(secretsToSync).length === 0) {
    console.log('No secrets to sync.');
    process.exit(0);
  }

  console.log(`Found ${Object.keys(secretsToSync).length} secrets to sync:\n`);
  Object.keys(secretsToSync).forEach(name => {
    console.log(`  - ${name}`);
  });
  console.log('');

  // Write secrets to temporary JSON file
  try {
    fs.writeFileSync(TEMP_SECRETS_FILE, JSON.stringify(secretsToSync, null, 2));
    console.log(`Temporary secrets file created: ${TEMP_SECRETS_FILE}\n`);
  } catch (err) {
    console.error(`❌ Failed to write secrets file: ${err.message}`);
    process.exit(1);
  }

  // Use wrangler pages secret bulk to upload
  try {
    console.log('Uploading secrets using wrangler...\n');
    execSync(
      `npx wrangler pages secret bulk ${TEMP_SECRETS_FILE} --project-name ${PROJECT_NAME}`,
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: token,
          CLOUDFLARE_ACCOUNT_ID: accountId,
        },
      }
    );
    console.log('\n✅ Secrets synced successfully!');
  } catch (err) {
    console.error(`\n❌ Failed to sync secrets: ${err.message}`);
    console.log('\nYou may need to set secrets manually in Cloudflare Pages Dashboard:');
    console.log(`https://dash.cloudflare.com/${accountId}/pages/view/${PROJECT_NAME}/settings/environment-variables`);
    cleanupTempFile();
    process.exit(1);
  }

  // Cleanup
  cleanupTempFile();

  console.log('\n--- Summary ---\n');
  console.log(`✅ Synced: ${setSecrets.length} secrets`);
  setSecrets.forEach(s => console.log(`   - ${s}`));

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (optional, not set): ${skipped.length}`);
  }
}

// Ensure cleanup on exit
process.on('exit', cleanupTempFile);
process.on('SIGINT', () => {
  cleanupTempFile();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanupTempFile();
  process.exit(143);
});

main().catch(err => {
  console.error('Fatal error:', err);
  cleanupTempFile();
  process.exit(1);
});
