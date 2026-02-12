# Secrets Sync Fix

## Problem

Secrets weren't being updated in Cloudflare Pages after pushing to main. The GitHub Actions deploy workflow was failing silently with Cloudflare API 500 errors:

```
❌ Failed to sync env: API error 500: [{"code":8000000,"message":"An unknown error occurred..."}]
```

The old script (`sync-secrets-to-cloudflare-pages.js`) used the Cloudflare REST API directly, which is notoriously flaky and returns 500 errors frequently when updating multiple environment variables.

## Solution

**Switched from Cloudflare REST API to Wrangler CLI**, which is more robust and handles retries internally.

### Changes Made

1. **New Script**: `scripts/sync-secrets-to-cloudflare-pages-wrangler.js`
   - Uses `wrangler pages secret bulk` command
   - Creates temporary JSON file with secrets
   - Much more reliable than direct API calls
   - Cleans up temp file automatically

2. **Updated Deploy Workflow**: `.github/workflows/deploy.yml`
   - Now tries wrangler CLI first
   - Falls back to API method if wrangler fails
   - Still has `continue-on-error: true` to not block deployments

3. **Updated package.json**:
   - `npm run pages:sync-env` → now uses wrangler (recommended)
   - `npm run pages:sync-env-api` → old API method (fallback)

## How It Works

### Automatic (on every push to main):

```bash
# GitHub Actions workflow runs:
1. Deploys site to Cloudflare Pages
2. Runs: node scripts/sync-secrets-to-cloudflare-pages-wrangler.js
   └─ If fails → fallback to API method
3. Deploys backup worker
```

### Manual (when you update secrets locally):

```bash
# Step 1: Update GitHub Secrets (from .secrets.local file)
npm run secrets:update

# Step 2: Update GitHub Variables (from .vars.local file)
npm run vars:update

# Step 3: Sync to Cloudflare Pages (uses wrangler CLI)
npm run pages:sync-env

# Alternative: Use API method directly (less reliable)
npm run pages:sync-env-api
```

## Wrangler vs API Method

| Method | Command | Reliability | Speed | Retries |
|--------|---------|-------------|-------|---------|
| **Wrangler CLI** | `wrangler pages secret bulk` | ✅ High | Fast | Built-in |
| **REST API** | `PATCH /pages/projects/:name` | ⚠️ Flaky (500s) | Slow | Manual (3x) |

## Required Environment Variables

Both methods need:
- `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_DEPLOY_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Plus all secrets to sync:
- `SESSION_SECRET` (required)
- `D1_DATABASE_ID` (optional)
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)
- `BACKUP_ENCRYPTION_KEY` (optional)
- `NOTIFY_BOARD_EMAIL` (optional)
- `NOTIFY_ARB_EMAIL` (optional)
- `NOTIFY_NOREPLY_EMAIL` (optional)
- `RESEND_API_KEY` (optional)
- `MAILCHANNELS_API_KEY` (optional)
- `TWILIO_ACCOUNT_SID` (optional)
- `TWILIO_AUTH_TOKEN` (optional)
- `TWILIO_PHONE_NUMBER` (optional)
- `RECAPTCHA_SECRET_KEY` (optional)

## Testing the Fix

### Local Test (requires .env.local with secrets):

```bash
# Sync secrets to Cloudflare Pages
npm run pages:sync-env
```

Expected output:
```
Syncing GitHub Secrets to Cloudflare Pages (using Wrangler CLI)

Project: clrhoa-site

Found X secrets to sync:
  - SESSION_SECRET
  - D1_DATABASE_ID
  ...

Temporary secrets file created: .secrets.tmp.json

Uploading secrets using wrangler...

🌀 Creating the secrets for the Pages project "clrhoa-site"
✨ Success! Created X secrets

✅ Secrets synced successfully!

--- Summary ---

✅ Synced: X secrets
   - SESSION_SECRET
   - D1_DATABASE_ID
   ...
```

### Verify in Cloudflare Dashboard:

1. Go to: https://dash.cloudflare.com/[account-id]/pages/view/clrhoa-site/settings/environment-variables
2. Check "Production" environment
3. Verify secrets are listed (values will be hidden)

## Troubleshooting

### "Wrangler sync failed"

If wrangler fails:
1. Check `CLOUDFLARE_API_TOKEN` has Pages:Edit permission
2. Check `CLOUDFLARE_ACCOUNT_ID` is correct
3. Try API fallback: `npm run pages:sync-env-api`
4. Manual fallback: Set secrets in Cloudflare Dashboard

### "Both sync methods failed"

1. **Check API token permissions**:
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Ensure token has "Cloudflare Pages:Edit" permission
   - Regenerate if needed, update GitHub Secret `CLOUDFLARE_DEPLOY_API_TOKEN`

2. **Check account ID**:
   ```bash
   npx wrangler whoami
   ```
   - Verify matches `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets

3. **Set secrets manually** (last resort):
   - Go to Cloudflare Dashboard → Pages → clrhoa-site → Settings → Environment variables
   - Click "Add variable" for each secret
   - Select "Encrypt" for secrets (not plain text)

### "Secrets not taking effect"

After syncing secrets, you may need to **redeploy** for changes to take effect:

```bash
# Trigger a new deployment (commit to main)
git commit --allow-empty -m "chore: trigger deployment to apply new secrets"
git push origin main
```

Or manually redeploy from Cloudflare Dashboard:
- Pages → clrhoa-site → Deployments → "Retry deployment"

## Migration Notes

**For existing deployments:**

If secrets were previously set manually in Cloudflare Dashboard, the new sync will overwrite them. This is expected behavior.

**If you had old secrets that are now removed**, you may need to manually delete them from Cloudflare Dashboard to clean up.

## Future Improvements

- [ ] Add `wrangler pages secret list` to verify sync
- [ ] Add diff check to only update changed secrets
- [ ] Add secret rotation automation
- [ ] Add secret value validation before sync

---

**Last Updated**: 2026-02-10
**Status**: Fixed and Deployed
**Maintainer**: Claude Code Assistant
