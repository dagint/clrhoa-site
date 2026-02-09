#!/usr/bin/env node
/**
 * Sync GitHub Secrets to Cloudflare Workers/Pages secrets.
 * This script reads secrets from environment variables (set by GitHub Actions)
 * and uses wrangler to set them in Cloudflare.
 * 
 * Usage: node scripts/sync-secrets-to-cloudflare.js
 * 
 * Required env vars:
 * - CLOUDFLARE_API_TOKEN (for authentication)
 * - CLOUDFLARE_ACCOUNT_ID (optional, can be in wrangler.toml)
 * 
 * Secrets to sync (set as env vars):
 * - SESSION_SECRET (required)
 * - All other secrets from env.d.ts (optional)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_SECRETS = [
  'SESSION_SECRET',
];

const OPTIONAL_SECRETS = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_DEPLOY_API_TOKEN',
  'CLOUDFLARE_BACKUP_API_TOKEN',
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
];

function checkWrangler() {
  try {
    execSync('wrangler --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function setSecret(name, value) {
  if (!value || value.trim() === '' || value.trim() === 'SET_ME') {
    console.log(`⏭️  Skipping ${name} (not set or placeholder)`);
    return false;
  }
  
  try {
    // Use wrangler secret put with stdin
    // Note: wrangler uses CLOUDFLARE_API_TOKEN env var for auth, so we use the deploy token
    const deployToken = process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    execSync(`echo "${value.replace(/"/g, '\\"')}" | wrangler secret put "${name}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: deployToken, // wrangler expects this env var name
      },
    });
    console.log(`✅ Set ${name}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to set ${name}:`, err.message);
    return false;
  }
}

function main() {
  console.log('Syncing GitHub Secrets to Cloudflare Workers/Pages\n');
  
  // Check for deploy token (used for wrangler auth)
  const deployToken = process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!deployToken) {
    console.error('Error: CLOUDFLARE_DEPLOY_API_TOKEN environment variable not set');
    console.log('Set it in GitHub Secrets (as CLOUDFLARE_DEPLOY_API_TOKEN) or export it before running this script');
    process.exit(1);
  }
  
  if (!checkWrangler()) {
    console.error('Error: wrangler CLI not found');
    console.log('Install: npm install -g wrangler');
    process.exit(1);
  }
  
  // Read wrangler.toml to get project name
  const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
  let projectName = 'clrhoa-site';
  if (fs.existsSync(wranglerPath)) {
    const wranglerContent = fs.readFileSync(wranglerPath, 'utf-8');
    const nameMatch = wranglerContent.match(/^name\s*=\s*["']?([^"'\n]+)["']?/m);
    if (nameMatch) {
      projectName = nameMatch[1];
    }
  }
  
  console.log(`Project: ${projectName}\n`);
  
  const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
  const set = [];
  const failed = [];
  const skipped = [];
  
  for (const name of allSecrets) {
    const value = process.env[name];
    if (!value || value.trim() === '') {
      if (REQUIRED_SECRETS.includes(name)) {
        console.error(`⚠️  Required secret ${name} is not set`);
        failed.push(name);
      } else {
        skipped.push(name);
      }
      continue;
    }
    
    if (setSecret(name, value)) {
      set.push(name);
    } else {
      failed.push(name);
    }
  }
  
  console.log('\n--- Summary ---\n');
  console.log(`✅ Set: ${set.length} secrets`);
  if (set.length > 0) {
    set.forEach(s => console.log(`   - ${s}`));
  }
  
  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (optional): ${skipped.length} secrets`);
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length} secrets`);
    failed.forEach(s => console.log(`   - ${s}`));
    process.exit(1);
  }
  
  console.log('\n✅ All secrets synced successfully');
}

main();
