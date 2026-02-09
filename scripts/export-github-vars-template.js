#!/usr/bin/env node
/**
 * Export PUBLIC_* variables from .env.local to a template file (.vars.local).
 * This file can be used to bulk-create GitHub Variables.
 * 
 * Run: node scripts/export-github-vars-template.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = '.env.local';
const OUTPUT_FILE = '.vars.local';

// All PUBLIC_* variables from env.d.ts
const PUBLIC_VARS = [
  'PUBLIC_STATICFORMS_API_KEY',
  'PUBLIC_RECAPTCHA_SITE_KEY',
  'PUBLIC_ANALYTICS_PROVIDER',
  'PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN',
  'SITE',
  'SITE_LAST_MODIFIED',
  'PUBLIC_SECURITY_EMAIL',
  'PUBLIC_MAILING_ADDRESS_NAME',
  'PUBLIC_MAILING_ADDRESS_LINE1',
  'PUBLIC_MAILING_ADDRESS_LINE2',
  'PUBLIC_PHYSICAL_ADDRESS_STREET',
  'PUBLIC_PHYSICAL_ADDRESS_CITY',
  'PUBLIC_PHYSICAL_ADDRESS_STATE',
  'PUBLIC_PHYSICAL_ADDRESS_ZIP',
  'PUBLIC_MEETING_LOCATION',
  'PUBLIC_MEETING_ROOM',
  'PUBLIC_MEETING_ADDRESS_STREET',
  'PUBLIC_MEETING_ADDRESS_CITY',
  'PUBLIC_MEETING_ADDRESS_STATE',
  'PUBLIC_MEETING_ADDRESS_ZIP',
  'PUBLIC_TRASH_SCHEDULE',
  'PUBLIC_RECYCLING_SCHEDULE',
  'PUBLIC_RECYCLING_CENTER_NAME',
  'PUBLIC_RECYCLING_CENTER_ADDRESS',
  'PUBLIC_RECYCLING_CENTER_HOURS',
  'PUBLIC_RECYCLING_CENTER_PHONE',
  'PUBLIC_RECYCLING_CENTER_WEBSITE',
  'PUBLIC_WASTE_MANAGEMENT_CONTACT',
  'PUBLIC_WASTE_MANAGEMENT_PHONE',
  'PUBLIC_WASTE_MANAGEMENT_WEBSITE',
  'PUBLIC_QUARTERLY_DUES_AMOUNT',
  'PUBLIC_PAYMENT_METHODS',
  'PUBLIC_LATE_FEE_AMOUNT',
  'PUBLIC_LATE_FEE_DAYS',
  'PUBLIC_PAYMENT_INSTRUCTIONS',
  'PUBLIC_PAYMENT_DROP_OFF_LOCATION',
  'PUBLIC_WATER_RESTRICTION_SCHEDULE',
  'PUBLIC_WATER_RESTRICTION_PHONE',
  'PUBLIC_WATER_RESTRICTION_WEBSITE',
  'PUBLIC_WATER_UTILITY_CONTACT',
  'PUBLIC_WATER_UTILITY_PHONE',
  'PUBLIC_WATER_UTILITY_WEBSITE',
  'PUBLIC_FACEBOOK_URL',
  'PUBLIC_TWITTER_URL',
  'PUBLIC_INSTAGRAM_URL',
  'PUBLIC_NEXTDOOR_URL',
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
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      vars[name] = cleanValue;
    }
  }
  
  return vars;
}

function main() {
  const inputPath = path.join(process.cwd(), INPUT_FILE);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: ${INPUT_FILE} not found`);
    console.log(`Create ${INPUT_FILE} with your PUBLIC_* variables first`);
    process.exit(1);
  }
  
  console.log(`Reading from: ${INPUT_FILE}\n`);
  
  const envVars = parseEnvFile(inputPath);
  const lines = [
    '# GitHub Variables Template (Build-time PUBLIC_* vars)',
    '# Fill in the values below, then run: npm run vars:update',
    '# This file is gitignored - do not commit it!',
    '#',
    '# Format: VAR_NAME=value',
    '# Leave empty for variables you don\'t want to set',
    '',
  ];
  
  // Add all PUBLIC_* vars
  for (const name of PUBLIC_VARS) {
    const value = envVars[name] || '';
    lines.push(`${name}=${value}`);
  }
  
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
  
  console.log(`✅ Template exported to: ${OUTPUT_FILE}\n`);
  console.log('Next steps:');
  console.log(`1. Edit ${OUTPUT_FILE} if needed`);
  console.log('2. Run: npm run vars:update');
  console.log(`\nNote: ${OUTPUT_FILE} is gitignored - your values are safe!`);
}

try {
  main();
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
