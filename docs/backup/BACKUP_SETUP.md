# Backup setup

Quick reference for enabling automated backups and Board backup download.

## 1. Backup Worker (cron → R2, optional Google Drive)

### If you use CI/CD (GitHub Actions deploy workflow)

On every push to `main`, the workflow now:

1. **Deploys** the backup Worker (so it gets code updates).
2. **Injects** `CLOUDFLARE_ACCOUNT_ID` from GitHub Secrets into `workers/backup/wrangler.toml` (replaces `REPLACE_WITH_ACCOUNT_ID`) so you don't commit the account ID.
3. **Syncs secrets** to the backup Worker from GitHub Secrets via `scripts/sync-backup-worker-secrets.js` (CLOUDFLARE_BACKUP_API_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKUP_ENCRYPTION_KEY, BACKUP_TRIGGER_SECRET).

Ensure those secrets are set in GitHub → Settings → Secrets and variables → Actions → Secrets. You do **not** need to manually edit `CLOUDFLARE_ACCOUNT_ID` in the file or run `wrangler secret put` for the backup worker when using CI/CD.

### If you deploy the backup Worker manually

From project root:

```bash
npm run backup:deploy
```

Before deploying, edit `workers/backup/wrangler.toml`:

- Set `CLOUDFLARE_ACCOUNT_ID` (your Cloudflare account id; replace `REPLACE_WITH_ACCOUNT_ID`).
- `D1_DATABASE_ID` should match the main app (same as in root `wrangler.toml`).

Set secrets (from project root):

```bash
npx wrangler secret put CLOUDFLARE_BACKUP_API_TOKEN --config workers/backup/wrangler.toml
```

Create an API token in Cloudflare Dashboard with **D1 Read** and **R2 Edit** (and **Account Read** if needed). The Worker uses it to trigger D1 export and write to R2.

Optional (Phase 3 – Google Drive):

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --config workers/backup/wrangler.toml
npx wrangler secret put GOOGLE_CLIENT_SECRET --config workers/backup/wrangler.toml
npx wrangler secret put BACKUP_ENCRYPTION_KEY --config workers/backup/wrangler.toml
```

Use a strong random string for `BACKUP_ENCRYPTION_KEY` (e.g. 32+ chars). Same key must be set in the **main app** (Pages) for the Google Drive OAuth callback to encrypt the refresh token.

## 2. Main app (Board “Download backup” and Google OAuth)

For **Download backup (ZIP)** to work, the main app (Pages) needs:

- **Vars** (in Cloudflare Pages env or root `wrangler.toml`): `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID` (optional; defaults to the id in wrangler).
- **Secret**: `CLOUDFLARE_BACKUP_API_TOKEN` (scoped: D1 Read, R2 Edit, KV Read).

For **Google Drive backup** (Connect Google Drive on Board → Backups):

- **Secrets**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKUP_ENCRYPTION_KEY` (same value as in the backup Worker).

Google Cloud setup:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API**.
3. Create **OAuth 2.0 Client ID** (Web application). Add authorized redirect URI: `https://your-site.com/api/board/google-drive-callback` (and `http://localhost:4321/api/board/google-drive-callback` for local).
4. Use the Client ID and Client Secret as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 3. Database migration

Ensure `backup_config` exists (for Google Drive settings):

```bash
npm run db:backup-config        # remote
npm run db:backup-config:local  # local
```

Or run full migrations: `npm run db:remote:all` / `npm run db:local:all`.

## 4. Board → Backups page

- **Download backup (ZIP):** Board or Admin only. Downloads current D1 + whitelist as a ZIP.
- **Connect Google Drive:** Starts OAuth; after consent, the refresh token is stored encrypted. Then set **Google Drive folder ID** (from the folder URL in Drive) and **Schedule**, and click **Save settings**.
- The backup Worker runs daily at 2:00 AM UTC. When Google Drive is enabled and the schedule matches, it uploads the same backup set to the configured folder.
