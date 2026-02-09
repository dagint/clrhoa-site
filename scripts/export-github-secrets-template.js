#!/usr/bin/env node
/**
 * Export GitHub secrets to a local template file (.secrets.local).
 * This file can be filled in and then used to update GitHub secrets.
 * 
 * Run: node scripts/export-github-secrets-template.js
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
  'RECAPTCHA_SECRET_KEY',
];

const OUTPUT_FILE = '.secrets.local';

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

function getSecretValue(repo, name) {
  try {
    // GitHub CLI doesn't allow reading secret values for security
    // So we'll just list them and mark as SET_ME if we can't read
    const list = execSync(`gh secret list --repo ${repo}`, { encoding: 'utf-8' });
    if (list.includes(name)) {
      return 'SET_ME'; // Placeholder since we can't read actual values
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Exporting GitHub Secrets Template\n');
  
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
  
  const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
  const lines = [
    '# GitHub Secrets Template',
    '# Fill in the values below, then run: node scripts/update-github-secrets-from-file.js',
    '# This file is gitignored - do not commit it!',
    '#',
    '# Format: SECRET_NAME=value',
    '# Leave empty or use SET_ME for secrets you don\'t want to set',
    '',
  ];
  
  // Secret descriptions for comments
  const secretDescriptions = {
    'SESSION_SECRET': 'Session encryption key (required)',
    'CLOUDFLARE_DEPLOY_API_TOKEN': 'Cloudflare API token for deployment (GitHub Actions). Required permissions: Cloudflare Pages Edit, Cloudflare Workers Edit, Account Read.',
    'CLOUDFLARE_BACKUP_API_TOKEN': 'Cloudflare API token for backup operations (manual downloads + backup Worker): D1 Read, R2 Edit, KV Read.',
    'CLOUDFLARE_ACCOUNT_ID': 'Your Cloudflare account ID',
    'D1_DATABASE_ID': 'D1 database UUID (from wrangler.toml or Cloudflare dashboard)',
    'GOOGLE_CLIENT_ID': 'Google OAuth client ID (for Google Drive backup)',
    'GOOGLE_CLIENT_SECRET': 'Google OAuth client secret (for Google Drive backup)',
    'BACKUP_ENCRYPTION_KEY': 'Encryption key for backup refresh tokens (32+ bytes)',
    'NOTIFY_BOARD_EMAIL': 'Email address for board notifications',
    'NOTIFY_ARB_EMAIL': 'Email address for ARB notifications',
    'NOTIFY_NOREPLY_EMAIL': 'Email sender address (e.g. noreply@yourdomain.com)',
    'RESEND_API_KEY': 'Resend API key (optional: if set, uses Resend; else MailChannels)',
    'MAILCHANNELS_API_KEY': 'MailChannels API key (fallback if Resend not set)',
    'TWILIO_ACCOUNT_SID': 'Twilio account SID (for SMS notifications)',
    'TWILIO_AUTH_TOKEN': 'Twilio auth token (for SMS notifications)',
    'TWILIO_PHONE_NUMBER': 'Twilio phone number (for SMS notifications)',
  };
  
  lines.push('# Required Secrets');
  lines.push('');
  for (const name of REQUIRED_SECRETS) {
    const value = getSecretValue(repo, name);
    const desc = secretDescriptions[name];
    if (desc) {
      lines.push(`# ${desc}`);
    }
    lines.push(`${name}=${value || 'SET_ME'}`);
    lines.push('');
  }
  
  lines.push('# Optional Secrets');
  lines.push('');
  for (const name of OPTIONAL_SECRETS) {
    const value = getSecretValue(repo, name);
    const desc = secretDescriptions[name];
    if (desc) {
      lines.push(`# ${desc}`);
    }
    lines.push(`${name}=${value || 'SET_ME'}`);
    lines.push('');
  }
  
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
  
  console.log(`✅ Template exported to: ${OUTPUT_FILE}\n`);
  console.log('Next steps:');
  console.log(`1. Edit ${OUTPUT_FILE} and fill in the values`);
  console.log('2. Run: node scripts/update-github-secrets-from-file.js');
  console.log(`\nNote: ${OUTPUT_FILE} is gitignored - your secrets are safe!`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
