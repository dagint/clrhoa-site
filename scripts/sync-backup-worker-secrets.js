#!/usr/bin/env node
/**
 * Sync GitHub Secrets to the backup Worker (clrhoa-backup).
 * Uses wrangler secret put with --config workers/backup/wrangler.toml.
 * Run from repo root. Requires: CLOUDFLARE_DEPLOY_API_TOKEN (or CLOUDFLARE_API_TOKEN).
 *
 * Backup worker secrets (set from env):
 * - CLOUDFLARE_BACKUP_API_TOKEN (required for backup operations)
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKUP_ENCRYPTION_KEY (optional, for Google Drive)
 * - BACKUP_TRIGGER_SECRET (optional, for HTTP trigger)
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_WRANGLER = path.join(__dirname, '..', 'workers', 'backup', 'wrangler.toml');

const BACKUP_SECRETS = [
  'CLOUDFLARE_BACKUP_API_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'BACKUP_ENCRYPTION_KEY',
  'BACKUP_TRIGGER_SECRET',
];

function setSecret(name, value) {
  if (!value || value.trim() === '' || value.trim() === 'SET_ME') {
    console.log(`⏭️  Skipping ${name} (not set or placeholder)`);
    return false;
  }
  try {
    const escaped = value.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    execSync(`echo "${escaped}" | npx wrangler secret put "${name}" --config "${BACKUP_WRANGLER}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN,
      },
    });
    console.log(`✅ Set ${name} on backup worker`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to set ${name}:`, err.message);
    return false;
  }
}

function main() {
  const token = process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error('Error: CLOUDFLARE_DEPLOY_API_TOKEN or CLOUDFLARE_API_TOKEN not set');
    process.exit(1);
  }

  console.log('Syncing secrets to backup Worker (clrhoa-backup)\n');

  let set = 0;
  for (const name of BACKUP_SECRETS) {
    const value = process.env[name];
    if (setSecret(name, value)) set++;
  }

  console.log(`\n✅ Synced ${set} secret(s) to backup worker`);
}

main();
