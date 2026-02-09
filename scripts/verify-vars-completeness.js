#!/usr/bin/env node
/**
 * Verify that all PUBLIC_* variables from env.d.ts are included in the export script.
 * Run: node scripts/verify-vars-completeness.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read env.d.ts
const envFile = path.join(__dirname, '..', 'src', 'env.d.ts');
const envContent = fs.readFileSync(envFile, 'utf-8');

// Extract from ImportMetaEnv interface
const importMetaMatch = envContent.match(/interface ImportMetaEnv\s*\{([^}]+)\}/s);
if (!importMetaMatch) {
  console.error('Could not find ImportMetaEnv interface');
  process.exit(1);
}

const importMetaContent = importMetaMatch[1];
const lines = importMetaContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/**') && !l.startsWith('*'));

const varsFromEnvDts = new Set();
for (const line of lines) {
  const match = line.match(/readonly\s+(\w+)\??:/);
  if (match) {
    varsFromEnvDts.add(match[1]);
  }
}

// Read export script
const exportScript = path.join(__dirname, 'export-github-vars-template.js');
const scriptContent = fs.readFileSync(exportScript, 'utf-8');

// Extract PUBLIC_VARS array
const varsArrayMatch = scriptContent.match(/const PUBLIC_VARS = \[([^\]]+)\]/s);
if (!varsArrayMatch) {
  console.error('Could not find PUBLIC_VARS array in export script');
  process.exit(1);
}

const varsFromScript = new Set();
const varsArrayContent = varsArrayMatch[1];
for (const line of varsArrayContent.split('\n')) {
  const match = line.match(/['"]([A-Z_][A-Z0-9_]*)['"]/);
  if (match) {
    varsFromScript.add(match[1]);
  }
}

// Compare
const missing = [];
const extra = [];

for (const v of varsFromEnvDts) {
  if (!varsFromScript.has(v)) {
    missing.push(v);
  }
}

for (const v of varsFromScript) {
  if (!varsFromEnvDts.has(v)) {
    extra.push(v);
  }
}

console.log('Variable Completeness Check\n');
console.log(`Variables in env.d.ts: ${varsFromEnvDts.size}`);
console.log(`Variables in export script: ${varsFromScript.size}\n`);

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
  console.log('✅ All variables match! Export script is complete.\n');
  console.log('Variables included:');
  Array.from(varsFromEnvDts).sort().forEach(v => console.log(`   - ${v}`));
} else {
  process.exit(1);
}
