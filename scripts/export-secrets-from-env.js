#!/usr/bin/env node
/**
 * Export runtime secrets from .env.local to .secrets.local.
 * Similar to vars:export but for secrets (runtime Workers secrets).
 * 
 * Run: node scripts/export-secrets-from-env.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = '.env.local';
const OUTPUT_FILE = '.secrets.local';

// Runtime secrets (Workers secrets) - NOT PUBLIC_* vars
const REQUIRED_SECRETS = [
  'SESSION_SECRET',
];

const OPTIONAL_SECRETS = [
  'CLOUDFLARE_DEPLOY_API_TOKEN', // Used for: GitHub Actions deployment (Pages Edit, Workers Edit)
  'CLOUDFLARE_BACKUP_API_TOKEN', // Used for: manual backup downloads + backup Worker (D1 Read, R2 Edit, KV Read)
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

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const vars = {};
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const [, name, value] = match;
      // Remove quotes if present, handle duplicate key=value format
      let cleanValue = value.replace(/^["']|["']$/g, '');
      // Handle case where value might be "KEY=value" (duplicate format)
      if (cleanValue.includes('=') && cleanValue.startsWith(name + '=')) {
        cleanValue = cleanValue.substring(name.length + 1);
      }
      vars[name] = cleanValue;
    }
  }
  
  return vars;
}

function main() {
  const inputPath = path.join(process.cwd(), INPUT_FILE);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: ${INPUT_FILE} not found`);
    console.log(`Create ${INPUT_FILE} with your secrets first`);
    process.exit(1);
  }
  
  console.log(`Reading from: ${INPUT_FILE}\n`);
  
  const envVars = parseEnvFile(inputPath);
  const lines = [
    '# GitHub Secrets Template (Runtime Workers secrets)',
    '# Fill in the values below, then run: npm run secrets:update',
    '# This file is gitignored - do not commit it!',
    '#',
    '# Format: SECRET_NAME=value',
    '# Leave empty or use SET_ME for secrets you don\'t want to set',
    '',
  ];
  
  // Add required secrets
  lines.push('# Required Secrets');
  lines.push('');
  for (const name of REQUIRED_SECRETS) {
    const value = envVars[name] || 'SET_ME';
    lines.push(`${name}=${value}`);
  }
  
  // Add optional secrets
  lines.push('');
  lines.push('# Optional Secrets');
  lines.push('');
  for (const name of OPTIONAL_SECRETS) {
    const value = envVars[name] || 'SET_ME';
    lines.push(`${name}=${value}`);
  }
  
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
  
  console.log(`✅ Template exported to: ${OUTPUT_FILE}\n`);
  console.log('Next steps:');
  console.log(`1. Review/edit ${OUTPUT_FILE} if needed`);
  console.log('2. Run: npm run secrets:update (to update GitHub Secrets)');
  console.log(`\nNote: ${OUTPUT_FILE} is gitignored - your secrets are safe!`);
}

try {
  main();
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
