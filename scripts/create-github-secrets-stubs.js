#!/usr/bin/env node
/**
 * Create stub/placeholder GitHub secrets for all required and optional secrets.
 * Sets them to "SET_ME" as a placeholder so they exist in GitHub.
 * 
 * Run: node scripts/create-github-secrets-stubs.js
 * Requires: GitHub CLI (gh auth login)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_SECRETS = [
  'SESSION_SECRET',
];

const OPTIONAL_SECRETS = [
  'CLOUDFLARE_DEPLOY_API_TOKEN',
  'CLOUDFLARE_BACKUP_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
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

const PLACEHOLDER = 'SET_ME';

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

function secretExists(repo, name) {
  try {
    execSync(`gh secret list --repo ${repo}`, { stdio: 'pipe', encoding: 'utf-8' });
    // Check if secret is in the list
    const list = execSync(`gh secret list --repo ${repo}`, { encoding: 'utf-8' });
    return list.includes(name);
  } catch {
    return false;
  }
}

function createSecret(repo, name, value) {
  try {
    execSync(`gh secret set ${name} --repo ${repo} --body "${value.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Failed to create ${name}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('Creating GitHub Secrets Stubs\n');
  
  if (!(await checkGhCli())) {
    console.error('Error: GitHub CLI (gh) not found.');
    console.log('Install: https://cli.github.com/');
    console.log('Then run: gh auth login');
    process.exit(1);
  }
  
  let repo = await getRepo();
  if (!repo) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const repoInput = await new Promise(resolve => rl.question('Enter GitHub repo (owner/repo): ', resolve));
    rl.close();
    if (!repoInput) {
      console.error('Repo required');
      process.exit(1);
    }
    repo = repoInput;
  }
  
  console.log(`Repository: ${repo}\n`);
  console.log(`Creating secrets with placeholder value: "${PLACEHOLDER}"`);
  console.log('You can update them later via GitHub UI or scripts/update-github-secrets-from-file.js\n');
  
  const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
  const created = [];
  const skipped = [];
  const failed = [];
  
  for (const name of allSecrets) {
    if (secretExists(repo, name)) {
      console.log(`⏭️  ${name} already exists, skipping`);
      skipped.push(name);
      continue;
    }
    
    console.log(`Creating ${name}...`);
    if (createSecret(repo, name, PLACEHOLDER)) {
      created.push(name);
    } else {
      failed.push(name);
    }
  }
  
  console.log('\n--- Summary ---\n');
  console.log(`✅ Created: ${created.length} secrets`);
  if (created.length > 0) {
    created.forEach(s => console.log(`   - ${s}`));
  }
  
  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (already exist): ${skipped.length} secrets`);
    skipped.forEach(s => console.log(`   - ${s}`));
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length} secrets`);
    failed.forEach(s => console.log(`   - ${s}`));
  }
  
  console.log('\n--- Next Steps ---\n');
  console.log('1. Export secrets template: node scripts/export-github-secrets-template.js');
  console.log('2. Fill in values in the generated .secrets.local file');
  console.log('3. Update GitHub secrets: node scripts/update-github-secrets-from-file.js');
  console.log('4. Or update manually in GitHub: Settings → Secrets and variables → Actions');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
