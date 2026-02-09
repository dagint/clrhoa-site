#!/usr/bin/env node
/**
 * List ALL environment variables (runtime secrets + build-time PUBLIC_* vars)
 * based on src/env.d.ts. Shows what needs to be set in GitHub Secrets/Variables.
 * 
 * Run: node scripts/list-all-env-vars.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = path.join(__dirname, '..', 'src', 'env.d.ts');
const content = fs.readFileSync(envFile, 'utf-8');

// Extract runtime secrets from Env interface
const envInterfaceMatch = content.match(/interface Env\s*\{([^}]+)\}/s);
const envContent = envInterfaceMatch ? envInterfaceMatch[1] : '';
const envLines = envContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/**') && !l.startsWith('*'));

const runtimeRequired = [];
const runtimeOptional = [];

for (const line of envLines) {
  const match = line.match(/^(\w+)(\?)?:\s*(.+);/);
  if (!match) continue;
  
  const [, name, optionalMarker] = match;
  // Skip bindings (DB, KV, R2) - these are configured in wrangler.toml
  if (['DB', 'CLOURHOA_USERS', 'CLOURHOA_FILES', 'KV', 'SESSION'].includes(name)) {
    continue;
  }
  
  if (optionalMarker === '?') {
    runtimeOptional.push(name);
  } else {
    runtimeRequired.push(name);
  }
}

// Extract build-time PUBLIC_* vars from ImportMetaEnv interface
const importMetaMatch = content.match(/interface ImportMetaEnv\s*\{([^}]+)\}/s);
const importMetaContent = importMetaMatch ? importMetaMatch[1] : '';
const importMetaLines = importMetaContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/**') && !l.startsWith('*') && !l.startsWith('readonly'));

const buildTimeVars = [];
for (const line of importMetaLines) {
  const match = line.match(/readonly\s+(\w+)\??:/);
  if (match) {
    buildTimeVars.push(match[1]);
  }
}

console.log('# Complete Environment Variables List\n');
console.log('This project uses TWO types of environment variables:\n');
console.log('1. **Runtime Secrets** (Workers secrets) - Set via GitHub Secrets → Cloudflare Workers');
console.log('2. **Build-time Variables** (PUBLIC_*) - Set via GitHub Variables → Cloudflare Pages build\n');

console.log('---\n');
console.log('# Required Runtime Secrets (Workers)\n');
console.log('Set these in GitHub → Settings → Secrets and variables → Actions → Secrets\n');
runtimeRequired.forEach(name => {
  console.log(`- ${name}`);
});

console.log('\n# Optional Runtime Secrets (Workers)\n');
console.log('Set these if you use the corresponding features:\n');
runtimeOptional.forEach(name => {
  console.log(`- ${name}`);
});

console.log('\n---\n');
console.log('# Build-time Variables (PUBLIC_*)\n');
console.log('Set these in GitHub → Settings → Secrets and variables → Actions → Variables');
console.log('(These are NOT secrets - they\'re embedded in the build)\n');

// Group by category
const categories = {
  'Form & Security': ['PUBLIC_STATICFORMS_API_KEY', 'PUBLIC_RECAPTCHA_SITE_KEY'],
  'Site Config': ['SITE', 'PUBLIC_ANALYTICS_PROVIDER', 'PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN'],
  'Contact Info': ['PUBLIC_SECURITY_EMAIL', 'PUBLIC_MAILING_ADDRESS_NAME', 'PUBLIC_MAILING_ADDRESS_LINE1', 'PUBLIC_MAILING_ADDRESS_LINE2'],
  'Physical Address': ['PUBLIC_PHYSICAL_ADDRESS_STREET', 'PUBLIC_PHYSICAL_ADDRESS_CITY', 'PUBLIC_PHYSICAL_ADDRESS_STATE', 'PUBLIC_PHYSICAL_ADDRESS_ZIP'],
  'Meeting Location': ['PUBLIC_MEETING_LOCATION', 'PUBLIC_MEETING_ROOM', 'PUBLIC_MEETING_ADDRESS_STREET', 'PUBLIC_MEETING_ADDRESS_CITY', 'PUBLIC_MEETING_ADDRESS_STATE', 'PUBLIC_MEETING_ADDRESS_ZIP'],
  'Waste Management': ['PUBLIC_TRASH_SCHEDULE', 'PUBLIC_RECYCLING_SCHEDULE', 'PUBLIC_RECYCLING_CENTER_NAME', 'PUBLIC_RECYCLING_CENTER_ADDRESS', 'PUBLIC_RECYCLING_CENTER_HOURS', 'PUBLIC_RECYCLING_CENTER_PHONE', 'PUBLIC_RECYCLING_CENTER_WEBSITE', 'PUBLIC_WASTE_MANAGEMENT_CONTACT', 'PUBLIC_WASTE_MANAGEMENT_PHONE', 'PUBLIC_WASTE_MANAGEMENT_WEBSITE'],
  'Dues & Payments': ['PUBLIC_QUARTERLY_DUES_AMOUNT', 'PUBLIC_PAYMENT_METHODS', 'PUBLIC_LATE_FEE_AMOUNT', 'PUBLIC_LATE_FEE_DAYS', 'PUBLIC_PAYMENT_INSTRUCTIONS', 'PUBLIC_PAYMENT_DROP_OFF_LOCATION'],
  'Water Restrictions': ['PUBLIC_WATER_RESTRICTION_SCHEDULE', 'PUBLIC_WATER_RESTRICTION_PHONE', 'PUBLIC_WATER_RESTRICTION_WEBSITE', 'PUBLIC_WATER_UTILITY_CONTACT', 'PUBLIC_WATER_UTILITY_PHONE', 'PUBLIC_WATER_UTILITY_WEBSITE'],
  'Social Media': ['PUBLIC_FACEBOOK_URL', 'PUBLIC_TWITTER_URL', 'PUBLIC_INSTAGRAM_URL', 'PUBLIC_NEXTDOOR_URL'],
};

const allBuildTime = new Set(buildTimeVars);
for (const [category, vars] of Object.entries(categories)) {
  const categoryVars = vars.filter(v => allBuildTime.has(v));
  if (categoryVars.length > 0) {
    console.log(`## ${category}`);
    categoryVars.forEach(v => console.log(`- ${v}`));
    console.log('');
  }
}

// Any remaining vars not in categories
const categorized = new Set(Object.values(categories).flat());
const remaining = buildTimeVars.filter(v => !categorized.has(v));
if (remaining.length > 0) {
  console.log('## Other');
  remaining.forEach(v => console.log(`- ${v}`));
  console.log('');
}

console.log('---\n');
console.log('# Setup Instructions\n');
console.log('## Runtime Secrets (Workers)');
console.log('1. Run: npm run secrets:create-stubs');
console.log('2. Run: npm run secrets:export');
console.log('3. Fill in .secrets.local');
console.log('4. Run: npm run secrets:update');
console.log('\n## Build-time Variables (PUBLIC_*)');
console.log('Quick setup from .env.local:');
console.log('1. Run: npm run vars:export (reads from .env.local)');
console.log('2. Review/edit .vars.local if needed');
console.log('3. Run: npm run vars:update (updates GitHub Variables)');
console.log('\nManual setup:');
console.log('1. Go to GitHub → Settings → Secrets and variables → Actions → Variables');
console.log('2. Add each PUBLIC_* variable above');
console.log('\nNote: Build-time vars are passed to the build automatically by the GitHub Actions workflow.');
