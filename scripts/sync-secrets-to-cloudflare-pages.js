#!/usr/bin/env node
/**
 * Sync GitHub Secrets (and optionally Variables) to Cloudflare Pages.
 * By default only runtime secrets are synced to avoid API 500s from large payloads.
 * PUBLIC_* are build-time only (used in GitHub Actions build); they are not needed in
 * Cloudflare when the build runs in GitHub.
 *
 * Usage: node scripts/sync-secrets-to-cloudflare-pages.js
 *        npm run pages:sync-env   (loads .env.local when not in CI)
 * Optional: SYNC_PAGES_VARS=1 to also sync PUBLIC_* and SITE (larger payload, may 500).
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (or CLOUDFLARE_DEPLOY_API_TOKEN)
 */

import fs from 'fs';
import path from 'path';

const REQUIRED_SECRETS = ['SESSION_SECRET'];

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

/** Build-time / public variables (from GitHub Variables). Synced as plain_text so they appear in Pages. */
const PAGES_VARS = [
  'SITE',
  'SITE_LAST_MODIFIED',
  'PUBLIC_STATICFORMS_API_KEY',
  'PUBLIC_RECAPTCHA_SITE_KEY',
  'PUBLIC_ANALYTICS_PROVIDER',
  'PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN',
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

const PROJECT_NAME = 'clrhoa-site';
const API_BASE = 'https://api.cloudflare.com/client/v4';

/** Max env vars per PATCH request. Use 1 to minimize payload and avoid Cloudflare API 500. */
const ENV_VARS_BATCH_SIZE = 1;

/** Retry delays in ms (transient 500s). */
const RETRY_DELAYS_MS = [0, 2000, 4000];

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

/** Get current deployment config for a project. */
async function getPagesProjectConfig(accountId, projectName) {
  const projectData = await fetchWithAuth(`${API_BASE}/accounts/${accountId}/pages/projects/${projectName}`);
  if (!projectData.result) throw new Error('Project not found');
  return projectData.result;
}

/**
 * Run a PATCH to set deployment_configs. Retries on 500 with backoff; optionally batches env vars.
 */
async function patchPagesConfig(accountId, projectName, deploymentConfigs, attempt = 0) {
  const url = `${API_BASE}/accounts/${accountId}/pages/projects/${projectName}`;
  const body = JSON.stringify({ deployment_configs: deploymentConfigs });
  const token = process.env.CLOUDFLARE_DEPLOY_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  if (delay > 0) {
    console.log(`   Retry in ${delay / 1000}s (attempt ${attempt + 1})...`);
    await new Promise((r) => setTimeout(r, delay));
  }
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  const data = response.json ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    const errMsg = data?.errors?.[0]?.message || data?.message || response.statusText;
    const err = new Error(`API error ${response.status}: ${JSON.stringify(data.errors || data) || errMsg}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Set all env vars (secrets + plain_text) for an environment. Retries on 500; batches if many vars. */
async function setPagesEnvVars(accountId, projectName, envVarsToSet, environment = 'production') {
  const entries = Object.entries(envVarsToSet);
  if (entries.length === 0) return;

  const project = await getPagesProjectConfig(accountId, projectName);
  const currentConfigs = project.deployment_configs || {};
  const envConfig = currentConfigs[environment] || {};
  let envVars = { ...(envConfig.env_vars || {}) };

  const batches = [];
  for (let i = 0; i < entries.length; i += ENV_VARS_BATCH_SIZE) {
    batches.push(entries.slice(i, i + ENV_VARS_BATCH_SIZE));
  }

  for (let b = 0; b < batches.length; b++) {
    for (const [name, entry] of batches[b]) {
      envVars[name] = entry;
    }
    const updatedConfigs = {
      ...currentConfigs,
      [environment]: {
        ...envConfig,
        env_vars: envVars,
      },
    };
    let lastErr;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      try {
        await patchPagesConfig(accountId, projectName, updatedConfigs, attempt);
        if (batches.length > 1) {
          console.log(`   Batch ${b + 1}/${batches.length} applied.`);
        }
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const is500 = err.status === 500;
        if (is500 && attempt < RETRY_DELAYS_MS.length - 1) continue;
        throw err;
      }
    }
    if (lastErr) throw lastErr;
    // Refresh project config for next batch so we don't overwrite
    if (b < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 400)); // gentle on API when sending one-by-one
      const updated = await getPagesProjectConfig(accountId, projectName);
      const nextEnvConfig = updated.deployment_configs?.[environment] || {};
      envVars = { ...(nextEnvConfig.env_vars || {}) };
    }
  }
}

/** When not in CI, load .env.local so running locally (e.g. npm run pages:sync-env) picks up vars. */
function loadEnvLocalIfNeeded() {
  if (process.env.CI === 'true') return;
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocalIfNeeded();
  console.log('Syncing GitHub Secrets and Variables to Cloudflare Pages\n');

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

  try {
    await getPagesProjectConfig(accountId, PROJECT_NAME);
    console.log('Project found.\n');
  } catch (err) {
    console.error(`❌ Failed to verify project: ${err.message}`);
    console.log('Make sure the project exists and the API token has Pages:Edit permission');
    process.exit(1);
  }

  const envVarsToSet = {};
  const setSecrets = [];
  const setVars = [];
  const failed = [];
  const skipped = [];

  const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
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
    envVarsToSet[name] = { type: 'secret', value };
    setSecrets.push(name);
  }

  // Only sync PUBLIC_* / SITE if opted in (large payload can trigger Cloudflare API 500)
  const syncPagesVars = process.env.SYNC_PAGES_VARS === '1' || process.env.SYNC_PAGES_VARS === 'true';
  if (syncPagesVars) {
    for (const name of PAGES_VARS) {
      const value = process.env[name];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        envVarsToSet[name] = { type: 'plain_text', value: String(value) };
        setVars.push(name);
      }
    }
  } else {
    console.log('Skipping PUBLIC_* vars (build-time only in GitHub). Set SYNC_PAGES_VARS=1 to sync them.\n');
  }

  try {
    await setPagesEnvVars(accountId, PROJECT_NAME, envVarsToSet, 'production');
    console.log(`✅ Updated Pages env: ${Object.keys(envVarsToSet).length} total (${setSecrets.length} secrets, ${setVars.length} plain-text vars)`);
  } catch (err) {
    console.error(`❌ Failed to sync env: ${err.message}`);
    process.exit(1);
  }

  console.log('\n--- Summary ---\n');
  console.log(`Secrets: ${setSecrets.length} set`);
  if (setSecrets.length > 0) setSecrets.forEach(s => console.log(`   - ${s}`));
  console.log(`Plain-text vars: ${setVars.length} set`);
  if (setVars.length > 0) setVars.forEach(v => console.log(`   - ${v}`));

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (optional secrets): ${skipped.length}`);
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
