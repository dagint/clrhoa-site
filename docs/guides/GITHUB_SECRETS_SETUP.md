# GitHub Secrets to Cloudflare Setup

This guide explains how to use GitHub Secrets to manage Cloudflare Workers/Pages secrets and environment variables, avoiding storing secrets in `wrangler.toml`.

## Overview

This project uses **two types** of environment variables:

1. **Runtime Secrets** (Workers secrets) — Sensitive values in **GitHub Secrets** → synced to Cloudflare
2. **Build-time Variables** — `PUBLIC_*` and `SITE` in **GitHub Variables** → passed into `npm run build`; baked into the site

- **GitHub Secrets** = API keys, tokens, passwords. Used at runtime and by the sync step. **Not** passed to the build.
- **GitHub Variables** = Dues amount, address, waste management, meeting location, etc. **Must** be Variables (not Secrets) or the live site will show placeholders or missing content.
- **Troubleshooting:** If the live site is missing dues/address/waste/meeting data, see [TROUBLESHOOTING_VARS_AND_DEPLOY.md](./TROUBLESHOOTING_VARS_AND_DEPLOY.md). Most often the values were added as Secrets instead of Variables.

## Quick Start

### 1. List Required Secrets

Run the helper script to see what secrets you need:

```bash
node scripts/list-required-secrets.js
```

This will show:
- **Required secrets** (must be set)
- **Optional secrets** (set if needed)

### 2. Set GitHub Secrets

Go to your GitHub repository:
1. **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each secret from the list

**Required runtime secrets:**
- `SESSION_SECRET` - Session encryption key (generate a random string)

**Required build-time variables:**
- `PUBLIC_STATICFORMS_API_KEY` - StaticForms API key for contact form
- `PUBLIC_RECAPTCHA_SITE_KEY` - (Optional) reCAPTCHA site key

**Optional build-time variables:** See `npm run vars:list` for complete list (addresses, meeting location, dues info, etc.)

**Quick setup for PUBLIC_* variables from .env.local:**

```bash
# Export from .env.local
npm run vars:export

# Review/edit .vars.local if needed

# Create GitHub Variables
npm run vars:update
```

**Optional secrets** (set if you use these features):
- `CLOUDFLARE_DEPLOY_API_TOKEN` - Cloudflare API token for deployment (GitHub Actions). **Required permissions:** Cloudflare Pages Edit, Cloudflare Workers Edit, Account Read. Get from Cloudflare Dashboard → My Profile → API Tokens. Use the "Edit Cloudflare Workers" preset template for easiest setup.
- `CLOUDFLARE_BACKUP_API_TOKEN` - Cloudflare API token for backup operations (manual downloads + backup Worker): D1 Read, R2 Edit, KV Read. Get from Cloudflare Dashboard → My Profile → API Tokens.
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID (optional, can be in wrangler.toml)
- `NOTIFY_NOREPLY_EMAIL` - Email sender address (e.g., noreply@yourdomain.com)
- `RESEND_API_KEY` or `MAILCHANNELS_API_KEY` - Email provider API key
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - For SMS
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - For Google Drive backups
- And others as needed (see `scripts/list-required-secrets.js`)

### 3. Bulk Create Stub Secrets (Recommended)

Create all secrets at once with placeholder values, then fill them in:

```bash
# Authenticate GitHub CLI
gh auth login

# Create all secrets with "SET_ME" placeholder
npm run secrets:create-stubs

# Export template file
npm run secrets:export

# Edit .secrets.local and fill in your values
# (This file is gitignored - safe to store locally)

# Update GitHub secrets from the file
npm run secrets:update
```

**Alternative:** Interactive setup (one-by-one):

```bash
# Authenticate
gh auth login

# Run interactive setup script
npm run secrets:setup
```

This will prompt you for each secret and create them in GitHub automatically.

### 4. Deploy

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will:
1. Build your site
2. Deploy to Cloudflare Pages
3. Sync secrets from GitHub to Cloudflare Workers

**First deployment:** Make sure `CLOUDFLARE_DEPLOY_API_TOKEN` is set in GitHub Secrets, then push to `main` branch.

### Scripts: GitHub vs Cloudflare

| Script | Pushes to | Purpose |
|--------|-----------|--------|
| `npm run secrets:update` | **GitHub** Secrets (from `.secrets.local`) | So the deploy workflow and sync have the values. Does **not** push to Cloudflare. |
| `npm run vars:update` | **GitHub** Variables (from `.vars.local`) | So the build gets `PUBLIC_*` and `SITE`. Does **not** push to Cloudflare. |
| `npm run pages:sync-env` | **Cloudflare Pages** (from `.env.local` or env) | Syncs runtime secrets (and optionally vars) to the Pages project. Use when the workflow sync step fails (e.g. API 500) or you want to update Cloudflare from your machine. Requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (or `CLOUDFLARE_DEPLOY_API_TOKEN`) in env or `.env.local`. Run from repo root; loads `.env.local` automatically when not in CI. |

So: **secrets:update** and **vars:update** only update GitHub. To get those values into **Cloudflare Pages**, the deploy workflow runs a sync step (or you run `npm run pages:sync-env` locally).

## How It Works

### GitHub Actions Workflow

The `.github/workflows/deploy.yml` workflow:
1. Builds the site with `npm run build`
2. Deploys to Cloudflare Pages using `cloudflare/pages-action`
3. Runs `scripts/sync-secrets-to-cloudflare.js` to sync secrets

### Secret Sync Script

`scripts/sync-secrets-to-cloudflare.js`:
- Reads secrets from environment variables (set by GitHub Actions)
- Uses `wrangler secret put` to set them in Cloudflare
- Only syncs secrets that are set (skips optional ones)

### wrangler.toml

Your `wrangler.toml` should **only** contain:
- Non-sensitive configuration (D1 database IDs, KV namespace IDs, R2 bucket names)
- Build settings
- **No secrets** (no API keys, tokens, or passwords)

Example:

```toml
name = "clrhoa-site"
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "clrhoa_db"
database_id = "a214f9da-3577-4ee7-bc50-bc9b9754a79c"

[[kv_namespaces]]
binding = "CLOURHOA_USERS"
id = "e936ea7760c04b268c4472eb24575d46"
# ... etc
```

**Secrets are set via:**
- GitHub Secrets → GitHub Actions → Cloudflare Workers (automated)
- Or manually: `wrangler secret put SECRET_NAME`

## Manual Secret Sync

If you need to sync secrets manually (outside of CI/CD):

```bash
# Set Cloudflare API token
export CLOUDFLARE_DEPLOY_API_TOKEN="your-deploy-token"
export CLOUDFLARE_BACKUP_API_TOKEN="your-backup-token"

# Set the secret value
export SESSION_SECRET="your-secret-value"

# Run sync script
node scripts/sync-secrets-to-cloudflare.js
```

Or use wrangler directly:

```bash
wrangler secret put SESSION_SECRET
# (prompts for value)
```

## Troubleshooting

### Secrets not syncing

1. **Check GitHub Secrets are set:**
   - Go to repo → Settings → Secrets and variables → Actions
   - Verify secrets exist

2. **Check workflow logs:**
   - Go to repo → Actions → Latest workflow run
   - Check "Sync Secrets to Cloudflare Workers" step for errors

3. **Verify CLOUDFLARE_DEPLOY_API_TOKEN:**
   - Must be set in GitHub Secrets
   - Must have permissions: Workers Scripts:Edit, Account:Cloudflare Pages:Edit

### "Missing sender" error

If you see `Missing sender: set NOTIFY_NOREPLY_EMAIL`, add it to GitHub Secrets:
- Name: `NOTIFY_NOREPLY_EMAIL`
- Value: Your verified sender email (e.g., `noreply@yourdomain.com`)

### Local development

For local development, create `.dev.vars` (not committed to git):

```bash
# .dev.vars
SESSION_SECRET=your-local-secret
NOTIFY_NOREPLY_EMAIL=noreply@yourdomain.com
RESEND_API_KEY=your-key
```

This file is automatically loaded by `wrangler dev` and should be in `.gitignore`.

## Security Best Practices

1. ✅ **Do:** Store secrets in GitHub Secrets
2. ✅ **Do:** Use `.dev.vars` for local development (gitignored)
3. ✅ **Do:** Keep `wrangler.toml` free of secrets
4. ❌ **Don't:** Commit secrets to git
5. ❌ **Don't:** Store secrets in `wrangler.toml`
6. ❌ **Don't:** Share secrets in chat/email

## Required GitHub Secrets Checklist

- [ ] `SESSION_SECRET` (required)
- [ ] `CLOUDFLARE_DEPLOY_API_TOKEN` (required for auto-sync)
- [ ] `NOTIFY_NOREPLY_EMAIL` (if using email)
- [ ] `RESEND_API_KEY` or `MAILCHANNELS_API_KEY` (if using email)
- [ ] Other secrets as needed (see `scripts/list-required-secrets.js`)

## See Also

- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
