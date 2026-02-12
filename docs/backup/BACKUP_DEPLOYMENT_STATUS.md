# Backup & Recovery Deployment Status

**Date:** 2026-02-12

## ✅ Completed Tasks

### 1. Fixed Configuration Issues
- ✅ Fixed corrupted line in `/src/pages/board/backups.astro` (removed "unt}" on line 41)
- ✅ Updated `workers/backup/wrangler.toml` with correct Cloudflare Account ID: `edd8cf1c48ad414729e72fb0bf468543`

### 2. Worker Deployments
- ✅ **Backup Worker** deployed successfully with **FULL BACKUP** capability
  - Name: `clrhoa-backup`
  - URL: https://clrhoa-backup.dagint.workers.dev
  - Schedule: Daily at 2:00 AM UTC (`0 2 * * *`)
  - Bindings: D1 (clrhoa_db), KV (CLOURHOA_USERS), R2 (clrhoa-files)
  - **NEW:** Now backs up D1 database + KV whitelist + **ALL R2 files**

- ✅ **Contact Cleanup Worker** deployed successfully
  - Name: `clrhoa-contact-cleanup`
  - URL: https://clrhoa-contact-cleanup.dagint.workers.dev
  - Schedule: Monthly on 1st at 3:00 AM UTC (`0 3 1 * *`)
  - Binding: D1 (clrhoa_db)

### 3. Secrets Configuration
Backup worker secrets configured via Cloudflare Dashboard:
- ✅ `CLOUDFLARE_BACKUP_API_TOKEN` (set via Dashboard - NOT wrangler CLI)
- ✅ `BACKUP_ENCRYPTION_KEY` (set)
- ✅ `GOOGLE_CLIENT_ID` (set)
- ✅ `GOOGLE_CLIENT_SECRET` (set)

### 4. Full Backup Implementation (2026-02-12)
- ✅ D1 database export (SQL dump, gzipped)
- ✅ KV whitelist dump (JSON)
- ✅ **R2 file backup** (server-side copy, all uploaded files)
- ✅ **R2 manifest** (file inventory with checksums, sizes, dates)
- ✅ Updated retention policy (cleans up old R2 backups after 30 days)
- ✅ **Complete restoration guide** created (`RESTORATION_GUIDE.md`)
- ✅ Google Drive sync includes R2 manifest

### 5. Data Cleanup Integration (2026-02-12)
- ✅ Created missing `contact_submissions` table (fixes contact form logging)
- ✅ **Merged cleanup logic into backup worker** (eliminates separate worker)
- ✅ Automated cleanup of old data after daily backup:
  - Contact submissions >1 year
  - Rate limit entries >7 days
  - Directory access logs >1 year
- ✅ Deprecated `contact-cleanup` worker (no longer needed)
- ✅ Simpler architecture: 1 worker instead of 2

## ⚠️ Issues Found

### 1. API Token Permission Error
**Status:** BLOCKING - Backup worker cannot export D1 database

**Error:**
```
D1 export start failed: 401 Authentication error
```

**Root Cause:** The `CLOUDFLARE_BACKUP_API_TOKEN` doesn't have the correct permissions to export D1 databases.

**Fix Required:** Create a new API token with these permissions:
1. Go to Cloudflare Dashboard → My Profile → API Tokens → Create Token
2. Use "Custom token" template
3. Add permissions:
   - **D1 - Read** (for database export)
   - **R2 - Edit** (for storing backups)
   - **Workers KV - Read** (for dumping whitelist)
4. Set Account Resources: Include → Your account
5. Create token and update the secret:
   ```bash
   npx wrangler secret put CLOUDFLARE_BACKUP_API_TOKEN --config workers/backup/wrangler.toml
   ```

### 2. Main Site Environment Variables
**Status:** NOT CONFIGURED - Manual backup download won't work

The main Pages site needs these environment variables for the `/api/board/backup-download` endpoint:
- ❌ `CLOUDFLARE_ACCOUNT_ID` = `edd8cf1c48ad414729e72fb0bf468543`
- ❌ `CLOUDFLARE_BACKUP_API_TOKEN` (same token as worker)

**Fix Required:**
```bash
# Set environment variables for Pages
npx wrangler pages secret put CLOUDFLARE_ACCOUNT_ID --project-name clrhoa-site
# Enter: edd8cf1c48ad414729e72fb0bf468543

npx wrangler pages secret put CLOUDFLARE_BACKUP_API_TOKEN --project-name clrhoa-site
# Enter: [same token created above]
```

Or set via Cloudflare Dashboard:
- Dashboard → Pages → clrhoa-site → Settings → Environment variables
- Add for both Production and Preview

## 📋 Next Steps

### Immediate (Required for Backup to Work)
1. **Create proper API token** with D1 Read, R2 Edit, Workers KV Read permissions
2. **Update backup worker secret** with new token
3. **Set Pages environment variables** for manual backup feature
4. **Test backup worker** via manual trigger
5. **Verify backups** are created in R2 bucket

### Testing Commands
```bash
# Test backup worker manually
curl -X POST https://clrhoa-backup.dagint.workers.dev/trigger \
  -H "Authorization: Bearer test-trigger-2024"

# Test contact cleanup worker manually
curl -X POST https://clrhoa-contact-cleanup.dagint.workers.dev/trigger \
  -H "Authorization: Bearer your-cleanup-secret"

# Check R2 bucket for backups
npx wrangler r2 object list clrhoa-files --prefix backups/d1/
npx wrangler r2 object list clrhoa-files --prefix backups/kv/

# View worker logs
npx wrangler tail clrhoa-backup --format=pretty
npx wrangler tail clrhoa-contact-cleanup --format=pretty
```

### Google Drive Integration (Phase 2)
Once Cloudflare native backups are working:
1. Test Google OAuth flow at `/api/board/google-drive-auth`
2. Configure backup folder in `/board/backups` UI
3. Enable Google Drive backups
4. Test end-to-end backup to Drive

## 🔄 Restoration Procedures

### Restore D1 Database
```bash
# Download latest backup from R2
npx wrangler r2 object get clrhoa-files/backups/d1/YYYY-MM-DD.sql.gz --file backup.sql.gz

# Extract
gunzip backup.sql.gz

# Import to D1
npx wrangler d1 execute clrhoa_db --remote --file backup.sql
```

### Restore KV Whitelist
```bash
# Download latest backup
npx wrangler r2 object get clrhoa-files/backups/kv/whitelist-YYYY-MM-DD.json --file whitelist.json

# Restore each entry (requires script)
# See: src/scripts/restore-kv-whitelist.js (to be created)
```

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Backup Worker Deployment | ✅ Working | Successfully backing up D1 + KV to R2 |
| Contact Cleanup Deployment | ✅ Deployed | Ready to test |
| Worker Secrets | ✅ Configured | Set via Dashboard (not wrangler CLI) |
| Pages Environment Vars | ⚠️ Needed | For manual download feature |
| R2 Backups | ✅ Working | Last run: 2026-02-12 18:23:47 UTC |
| Google Drive Backups | ⏸️ Not Tested | Phase 2 - after R2 verified |
| Manual Download | ⚠️ Pending | Needs Pages env vars |

## 🎯 Success Criteria

- [x] Workers deployed with cron schedules
- [x] D1 database exports successfully to R2
- [x] KV whitelist dumps successfully to R2
- [ ] Retention policy removes old backups (30 days) - will apply on next run
- [ ] Manual backup download works from /board/backups
- [x] Backup status shows last run time
- [ ] Google Drive integration tested (optional)
- [ ] Restoration procedures documented and tested

## ✅ Resolution (2026-02-12)

**Root Cause:** Worker secrets set via `wrangler secret put` were not being passed to the worker environment.

**Solution:** Set secrets via Cloudflare Dashboard instead:
1. Dashboard → Workers & Pages → clrhoa-backup
2. Settings → Variables → Add variable
3. Set `CLOUDFLARE_BACKUP_API_TOKEN` as **Secret** (encrypted)
4. Click "Save and Deploy"

**Additional Fix:** Modified `exportD1()` function to handle cases where small databases complete export immediately (status="complete" on first response) instead of requiring polling.

**API Token Requirements (CONFIRMED WORKING):**
- D1 - **Edit** (not Read - export API requires write permission)
- R2 - **Edit**
- Workers KV - **Read**
- Account Resources: All accounts (or specific account with resources)
