# Fix: Cloudflare Pages Secrets Sync

## Problem

The original sync script (`sync-secrets-to-cloudflare.js`) used `wrangler secret put`, which is for **Workers**, not **Cloudflare Pages**. This caused secrets to not sync properly to the Pages project.

## Solution

Created a new script (`sync-secrets-to-cloudflare-pages.js`) that uses the **Cloudflare Pages API** to set environment variables/secrets directly on the Pages project.

### Changes Made

1. **New script**: `scripts/sync-secrets-to-cloudflare-pages.js`
   - Uses Pages API: `PATCH /accounts/{account_id}/pages/projects/{project_name}`
   - Updates `deployment_configs[environment].env_vars` with `type: "secret"` for encrypted values
   - Works for both `production` and `preview` environments

2. **Updated workflow**: `.github/workflows/deploy.yml`
   - Changed step name from "Sync Secrets to Cloudflare Workers" to "Sync Secrets to Cloudflare Pages"
   - Now calls `sync-secrets-to-cloudflare-pages.js` instead of the old script
   - Removed `npm install -g wrangler` (not needed for Pages API)

3. **Old script kept**: `scripts/sync-secrets-to-cloudflare.js`
   - Still exists for Workers (like the backup worker)
   - Not used by the main Pages deployment

## How It Works

The new script:
1. Gets the current project config from Pages API
2. Updates `deployment_configs.production.env_vars` (or `preview`)
3. Sets each secret with `type: "secret"` (encrypted) or `type: "plain_text"` (for non-secrets)
4. PATCHes the project with updated config

## Testing

After deploying this fix:

1. **Check GitHub Secrets** are set (they should be)
2. **Run the workflow** (push to main or manual trigger)
3. **Verify in Cloudflare Dashboard**:
   - Go to Workers & Pages → clrhoa-site → Settings → Environment variables
   - Check that all secrets are present in **Production** environment
   - They should show as encrypted (🔒 icon)

## Manual Sync (if needed)

If you need to sync secrets manually:

```bash
export CLOUDFLARE_API_TOKEN=your_token
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export SESSION_SECRET=your_secret
export RECAPTCHA_SECRET_KEY=your_key
# ... etc

node scripts/sync-secrets-to-cloudflare-pages.js
```

## What Secrets Are Synced

All secrets from `OPTIONAL_SECRETS` and `REQUIRED_SECRETS` in the script:
- SESSION_SECRET (required)
- RECAPTCHA_SECRET_KEY (optional)
- NOTIFY_BOARD_EMAIL, NOTIFY_ARB_EMAIL, NOTIFY_NOREPLY_EMAIL
- RESEND_API_KEY, MAILCHANNELS_API_KEY
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKUP_ENCRYPTION_KEY
- TWILIO_* (if used)
- etc.

## Backup Worker (clrhoa-backup)

The backup worker is a **separate** Worker (not Pages). So that it gets code and secret updates on every deploy:

1. **Deploy step**: The workflow runs `npx wrangler deploy --config workers/backup/wrangler.toml` so the backup worker is redeployed with the latest code.
2. **Account ID**: The workflow injects `CLOUDFLARE_ACCOUNT_ID` from GitHub Secrets into `workers/backup/wrangler.toml` (replacing `REPLACE_WITH_ACCOUNT_ID`) before deploy, so you don't have to commit the account ID.
3. **Secrets sync**: After deploy, `scripts/sync-backup-worker-secrets.js` runs and sets the backup worker's secrets from GitHub Secrets (CLOUDFLARE_BACKUP_API_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKUP_ENCRYPTION_KEY, BACKUP_TRIGGER_SECRET) via `wrangler secret put --config workers/backup/wrangler.toml`.

So the backup worker now gets both **code updates** and **secret updates** on every push to main.

## Contact Cleanup Worker (clrhoa-contact-cleanup)

**This worker does not need any secrets or vars from the main app or GitHub.** It only needs:

- **D1** — already in its `wrangler.toml`.
- **CLEANUP_TRIGGER_SECRET** (optional) — only if you want to call the HTTP trigger; set manually via `wrangler secret put CLEANUP_TRIGGER_SECRET --config workers/contact-cleanup/wrangler.toml`.

The deploy workflow does **not** deploy or sync the cleanup worker. Deploy it once with `npm run contact-cleanup:deploy` if you want the monthly cron; no ongoing sync needed.

## Notes

- Pages sync script only syncs secrets that are **set** (not empty, not "SET_ME")
- It skips optional secrets that aren't set
- It fails if required secrets are missing
- Secrets are set for the **production** environment by default
