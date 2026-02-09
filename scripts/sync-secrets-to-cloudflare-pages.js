#!/usr/bin/env node
/**
 * Sync GitHub Secrets to Cloudflare Pages environment variables/secrets.
 * Uses the Cloudflare Pages API (not wrangler secret put, which is for Workers).
 * 
 * Usage: node scripts/sync-secrets-to-cloudflare-pages.js
 * 
 * Required env vars:
 * - CLOUDFLARE_API_TOKEN (for authentication)
 * - CLOUDFLARE_ACCOUNT_ID
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
  'RECAPTCHA_SECRET_KEY',
];

const PROJECT_NAME = 'clrhoa-site';
const API_BASE = 'https://api.cloudflare.com/client/v4';

async function fetchWithAuth(url, options = {}) {
  const token = process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN or CLOUDFLARE_DEPLOY_API_TOKEN not set');
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  
  return response.json();
}


async function setPagesSecret(accountId, projectName, name, value, environment = 'production') {
  // Cloudflare Pages API: PATCH /accounts/:account_id/pages/projects/:project_name
  // Update deployment_configs.env_vars for the specified environment
  
  // Get current project config
  const projectData = await fetchWithAuth(`${API_BASE}/accounts/${accountId}/pages/projects/${projectName}`);
  const currentConfigs = projectData.result?.deployment_configs || {};
  
  // Update the environment-specific config
  const envConfig = currentConfigs[environment] || {};
  const envVars = { ...(envConfig.env_vars || {}) };
  
  // Set the secret (type: "secret" for encrypted, "plain_text" for regular vars)
  // All secrets should be encrypted
  envVars[name] = {
    type: 'secret',
    value: value,
  };
  
  const updatedConfigs = {
    ...currentConfigs,
    [environment]: {
      ...envConfig,
      env_vars: envVars,
    },
  };
  
  // Update the project
  await fetchWithAuth(`${API_BASE}/accounts/${accountId}/pages/projects/${projectName}`, {
    method: 'PATCH',
    body: JSON.stringify({
      deployment_configs: updatedConfigs,
    }),
  });
  
  console.log(`✅ Set ${name} for ${environment}`);
}

async function main() {
  console.log('Syncing GitHub Secrets to Cloudflare Pages\n');
  
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    console.error('Error: CLOUDFLARE_ACCOUNT_ID environment variable not set');
    process.exit(1);
  }
  
  const token = process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error('Error: CLOUDFLARE_API_TOKEN or CLOUDFLARE_DEPLOY_API_TOKEN not set');
    process.exit(1);
  }
  
  console.log(`Account ID: ${accountId}`);
  console.log(`Project: ${PROJECT_NAME}\n`);
  
  // Verify project exists
  try {
    const projectData = await fetchWithAuth(`${API_BASE}/accounts/${accountId}/pages/projects/${PROJECT_NAME}`);
    if (!projectData.result) {
      throw new Error('Project not found');
    }
    console.log(`Project found: ${projectData.result.name}\n`);
  } catch (err) {
    console.error(`❌ Failed to verify project: ${err.message}`);
    console.log('Make sure the project exists and the API token has Pages:Edit permission');
    process.exit(1);
  }
  
  const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
  const set = [];
  const failed = [];
  const skipped = [];
  
  for (const name of allSecrets) {
    const value = process.env[name];
    if (!value || value.trim() === '' || value.trim() === 'SET_ME') {
      if (REQUIRED_SECRETS.includes(name)) {
        console.error(`⚠️  Required secret ${name} is not set`);
        failed.push(name);
      } else {
        skipped.push(name);
      }
      continue;
    }
    
    try {
      await setPagesSecret(accountId, PROJECT_NAME, name, value, 'production');
      set.push(name);
    } catch (err) {
      console.error(`❌ Failed to set ${name}: ${err.message}`);
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

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
