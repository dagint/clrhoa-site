#!/usr/bin/env node
/**
 * Sync GitHub Secrets and Variables to Cloudflare Pages.
 * Sets both secrets (encrypted) and plain-text env vars so they appear in the
 * dashboard and are available at build + runtime.
 *
 * Usage: node scripts/sync-secrets-to-cloudflare-pages.js
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (or CLOUDFLARE_DEPLOY_API_TOKEN)
 */

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

/** Set all env vars (secrets + plain_text) for an environment in one PATCH. */
async function setPagesEnvVars(accountId, projectName, envVarsToSet, environment = 'production') {
  const project = await getPagesProjectConfig(accountId, projectName);
  const currentConfigs = project.deployment_configs || {};
  const envConfig = currentConfigs[environment] || {};
  const envVars = { ...(envConfig.env_vars || {}) };

  for (const [name, entry] of Object.entries(envVarsToSet)) {
    envVars[name] = entry;
  }

  const updatedConfigs = {
    ...currentConfigs,
    [environment]: {
      ...envConfig,
      env_vars: envVars,
    },
  };

  await fetchWithAuth(`${API_BASE}/accounts/${accountId}/pages/projects/${projectName}`, {
    method: 'PATCH',
    body: JSON.stringify({
      deployment_configs: updatedConfigs,
    }),
  });
}

async function main() {
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

  for (const name of PAGES_VARS) {
    const value = process.env[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      envVarsToSet[name] = { type: 'plain_text', value: String(value) };
      setVars.push(name);
    }
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
