#!/usr/bin/env node
/**
 * List all required Cloudflare Workers secrets and environment variables
 * based on src/env.d.ts. Use this to ensure GitHub secrets are set.
 * 
 * Run: node scripts/list-required-secrets.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = path.join(__dirname, '..', 'src', 'env.d.ts');
const content = fs.readFileSync(envFile, 'utf-8');

// Extract secrets from Env interface (required and optional)
const envInterfaceMatch = content.match(/interface Env\s*\{([^}]+)\}/s);
if (!envInterfaceMatch) {
  console.error('Could not find Env interface in env.d.ts');
  process.exit(1);
}

const envContent = envInterfaceMatch[1];
const lines = envContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/**') && !l.startsWith('*'));

const required = [];
const optional = [];

for (const line of lines) {
  const match = line.match(/^(\w+)(\?)?:\s*(.+);/);
  if (!match) continue;
  
  const [, name, optionalMarker] = match;
  // Skip bindings (DB, KV, R2) - these are configured in wrangler.toml
  if (['DB', 'CLOURHOA_USERS', 'CLOURHOA_FILES', 'KV', 'SESSION'].includes(name)) {
    continue;
  }
  
  if (optionalMarker === '?') {
    optional.push(name);
  } else {
    required.push(name);
  }
}

console.log('# Required Cloudflare Workers Secrets\n');
console.log('These MUST be set in GitHub Secrets and synced to Cloudflare:\n');
required.forEach(name => {
  console.log(`- ${name}`);
});
console.log('\n# Optional Cloudflare Workers Secrets\n');
console.log('These can be set if needed:\n');
optional.forEach(name => {
  console.log(`- ${name}`);
});

console.log('\n# GitHub Actions Setup\n');
console.log('1. Go to your GitHub repo → Settings → Secrets and variables → Actions');
console.log('2. Add each secret above as a repository secret');
console.log('3. The deployment workflow will sync them to Cloudflare automatically');
console.log('\n# Quick Setup Script\n');
console.log('Run: node scripts/setup-github-secrets.js');
console.log('(Requires GitHub CLI: gh auth login)');
