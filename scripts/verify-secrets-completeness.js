#!/usr/bin/env node
/**
 * Verify that all runtime secrets from env.d.ts are included in the secret scripts.
 * Run: node scripts/verify-secrets-completeness.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read env.d.ts
const envFile = path.join(__dirname, '..', 'src', 'env.d.ts');
const envContent = fs.readFileSync(envFile, 'utf-8');

// Extract from Env interface
const envInterfaceMatch = envContent.match(/interface Env\s*\{([^}]+)\}/s);
if (!envInterfaceMatch) {
  console.error('Could not find Env interface');
  process.exit(1);
}

const envContent2 = envInterfaceMatch[1];
const lines = envContent2.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/**') && !l.startsWith('*'));

const secretsFromEnvDts = new Set();
for (const line of lines) {
  const match = line.match(/^(\w+)(\?)?:\s*(.+);/);
  if (!match) continue;
  
  const [, name] = match;
  // Skip bindings (DB, KV, R2) - these are configured in wrangler.toml
  if (['DB', 'CLOURHOA_USERS', 'CLOURHOA_FILES', 'KV', 'SESSION'].includes(name)) {
    continue;
  }
  
  secretsFromEnvDts.add(name);
}

// Read export script
const exportScript = path.join(__dirname, 'export-secrets-from-env.js');
const scriptContent = fs.readFileSync(exportScript, 'utf-8');

// Extract REQUIRED_SECRETS and OPTIONAL_SECRETS arrays
const requiredMatch = scriptContent.match(/const REQUIRED_SECRETS = \[([^\]]+)\]/s);
const optionalMatch = scriptContent.match(/const OPTIONAL_SECRETS = \[([^\]]+)\]/s);

const secretsFromScript = new Set();
if (requiredMatch) {
  const requiredContent = requiredMatch[1];
  for (const line of requiredContent.split('\n')) {
    const match = line.match(/['"]([A-Z_][A-Z0-9_]*)['"]/);
    if (match) secretsFromScript.add(match[1]);
  }
}
if (optionalMatch) {
  const optionalContent = optionalMatch[1];
  for (const line of optionalContent.split('\n')) {
    const match = line.match(/['"]([A-Z_][A-Z0-9_]*)['"]/);
    if (match) secretsFromScript.add(match[1]);
  }
}

// Compare
const missing = [];
const extra = [];

for (const v of secretsFromEnvDts) {
  if (!secretsFromScript.has(v)) {
    missing.push(v);
  }
}

for (const v of secretsFromScript) {
  if (!secretsFromEnvDts.has(v)) {
    extra.push(v);
  }
}

console.log('Runtime Secrets Completeness Check\n');
console.log(`Secrets in env.d.ts: ${secretsFromEnvDts.size}`);
console.log(`Secrets in export script: ${secretsFromScript.size}\n`);

if (missing.length > 0) {
  console.log('❌ MISSING from export script:');
  missing.forEach(v => console.log(`   - ${v}`));
  console.log('');
}

if (extra.length > 0) {
  console.log('⚠️  EXTRA in export script (not in env.d.ts):');
  extra.forEach(v => console.log(`   - ${v}`));
  console.log('');
}

if (missing.length === 0 && extra.length === 0) {
  console.log('✅ All runtime secrets match! Export script is complete.\n');
  console.log('Secrets included:');
  Array.from(secretsFromEnvDts).sort().forEach(v => {
    const isRequired = v === 'SESSION_SECRET';
    console.log(`   ${isRequired ? '✓' : '○'} ${v}${isRequired ? ' (required)' : ''}`);
  });
} else {
  process.exit(1);
}
