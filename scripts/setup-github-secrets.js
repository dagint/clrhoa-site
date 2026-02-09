#!/usr/bin/env node
/**
 * Interactive script to create GitHub secrets from a template.
 * Requires GitHub CLI: gh auth login
 * 
 * Run: node scripts/setup-github-secrets.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Required secrets from env.d.ts
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

async function checkGhCli() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function getRepo() {
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {}
  return null;
}

async function setSecret(repo, name, value) {
  try {
    execSync(`gh secret set ${name} --repo ${repo} --body "${value.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Failed to set ${name}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('GitHub Secrets Setup for Cloudflare Workers\n');
  
  if (!(await checkGhCli())) {
    console.error('Error: GitHub CLI (gh) not found.');
    console.log('Install: https://cli.github.com/');
    console.log('Then run: gh auth login');
    process.exit(1);
  }
  
  const repo = await getRepo();
  if (!repo) {
    const repoInput = await question('Enter GitHub repo (owner/repo): ');
    if (!repoInput) {
      console.error('Repo required');
      process.exit(1);
    }
    repo = repoInput;
  }
  
  console.log(`\nRepository: ${repo}\n`);
  console.log('This script will help you create GitHub secrets.');
  console.log('You can skip any secret by pressing Enter.\n');
  
  const secrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
  const set = [];
  const skipped = [];
  
  for (const name of REQUIRED_SECRETS) {
    const value = await question(`${name} (required): `);
    if (value.trim()) {
      if (await setSecret(repo, name, value)) {
        set.push(name);
      }
    } else {
      console.log(`⚠️  Skipped required secret: ${name}`);
      skipped.push(name);
    }
  }
  
  console.log('\n--- Optional Secrets ---\n');
  for (const name of OPTIONAL_SECRETS) {
    const value = await question(`${name} (optional, press Enter to skip): `);
    if (value.trim()) {
      if (await setSecret(repo, name, value)) {
        set.push(name);
      }
    } else {
      skipped.push(name);
    }
  }
  
  console.log('\n--- Summary ---\n');
  console.log(`✅ Set: ${set.length} secrets`);
  if (set.length > 0) {
    set.forEach(s => console.log(`   - ${s}`));
  }
  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped: ${skipped.length} secrets`);
    skipped.forEach(s => console.log(`   - ${s}`));
  }
  
  if (skipped.some(s => REQUIRED_SECRETS.includes(s))) {
    console.log('\n⚠️  Warning: Some required secrets were skipped. Set them manually in GitHub.');
  }
  
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
