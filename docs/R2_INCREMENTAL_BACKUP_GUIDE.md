# R2 Incremental Backup Implementation Guide

## Overview

The backup system now includes **incremental R2 file backup** to Google Drive. This means:
- ✅ Only NEW or CHANGED files are uploaded each backup run
- ✅ First backup uploads all existing files (one-time)
- ✅ Subsequent backups are fast and minimal (only new files)
- ✅ Smart change detection using file checksums (etag)
- ✅ Maintains folder structure in Google Drive
- ✅ Automatic state tracking

## What Gets Backed Up

### Always (to R2 and optionally to Google Drive):
1. **D1 Database** - Complete SQL export (compressed)
2. **KV Whitelist** - All authorized user emails
3. **R2 File Manifest** - JSON inventory of all uploaded files

### Optional (Google Drive only):
4. **R2 Actual Files** - User-uploaded files (ARB requests, vendor documents, etc.)
   - Uses incremental backup (only new/changed files)
   - Preserves folder structure (e.g., `arb/review/ABC123-photo.jpg`)
   - Tracks state to avoid re-uploading unchanged files

## How Incremental Backup Works

### State Tracking
The system maintains a `r2-backup-state.json` file in Google Drive that records:
```json
{
  "lastBackupDate": "2025-02-12",
  "totalFiles": 245,
  "totalBytes": 52428800,
  "files": {
    "arb/review/ABC123-photo1.jpg": {
      "etag": "d8e8fca2dc0f896fd7cb4cb0031ba249",
      "size": 2048576,
      "uploaded": "2025-02-10T14:30:00Z"
    },
    ...
  }
}
```

### Change Detection
Each backup run:
1. Lists all current R2 files
2. Compares with last backup state
3. Identifies files that are:
   - **New**: Not in last state
   - **Changed**: Different etag (checksum)
   - **Unchanged**: Same etag → skip upload
4. Uploads only new/changed files
5. Updates state file

### Example Scenarios

**Scenario 1: First Backup**
- Current files: 500MB (200 files)
- State file: doesn't exist
- **Action**: Upload all 200 files + create state file
- **Time**: ~10 minutes (depending on connection)

**Scenario 2: Daily Backup (typical)**
- New ARB requests: 2 requests × 5 photos = 10 files (~20MB)
- Changed files: 0
- Unchanged files: 200 (skipped)
- **Action**: Upload 10 new files + update state file
- **Time**: ~30 seconds

**Scenario 3: File Modified**
- User replaces a vendor license PDF (1 file changed)
- New files: 0
- Changed files: 1
- Unchanged files: 209 (skipped)
- **Action**: Upload 1 changed file + update state file
- **Time**: ~5 seconds

## Cost Analysis

### Cloudflare R2 Costs
- **Storage**: $0.015/GB/month
- **Egress to Google Drive**: FREE (zero egress fees)
- **API Operations**:
  - Class A (write): $4.50/million
  - Class B (read): $0.36/million

### Typical Monthly Costs (Example HOA)
**Assumptions:**
- Current files: 500MB
- New files daily: 20MB (2-3 ARB requests)
- Monthly growth: ~600MB

**Operations:**
- First backup: 200 reads (list + get) = $0.0000072
- Daily backups: 10 reads/day × 30 days = $0.000108
- **Total monthly cost**: < $0.01 (essentially free!)

### Google Drive Storage
- Free tier: 15GB per account
- Workspace: 30GB+ per user
- HOA backup typically: 1-2GB total

## Setup Instructions

### 1. Complete OAuth Setup (If Not Done)

Visit your production site:
```
https://clrhoa.com/board/backups
```

Click **"Connect Google Drive"** and authorize access.

### 2. Enable R2 File Backup

On the same page, check the following options:

- ✅ **Enable Google Drive backup**
- ✅ **R2 file manifest** (recommended - always keep checked)
- ☐ **R2 actual files** (check this to enable incremental file backup)

Enter your Google Drive folder ID and save settings.

### 3. Trigger First Backup

The first backup will upload all existing files. You can either:

**Option A: Wait for scheduled backup** (2:00 AM UTC daily)

**Option B: Trigger manually** (recommended for first run):
```bash
# Trigger backup immediately via Worker
npx wrangler deploy --config workers/backup/wrangler.toml --test-scheduled
```

Or create a manual trigger endpoint (requires setting BACKUP_TRIGGER_SECRET):
```bash
# Set secret for manual triggering
npx wrangler secret put BACKUP_TRIGGER_SECRET --config workers/backup/wrangler.toml
# Enter a random secret (e.g., generated via: openssl rand -base64 32)

# Trigger backup via API
curl -X POST https://clrhoa-backup.dagint.workers.dev/trigger \
  -H "Authorization: Bearer YOUR_SECRET_HERE"
```

### 4. Monitor Progress

Check your Google Drive folder:
```
📁 CLRHOA Backups (folder ID: 1OMxrvjqkyiIPl6e5e-X2jMjF1eno4YVz)
  📄 2025-02-12.sql.gz (database)
  📄 whitelist-2025-02-12.json (users)
  📄 r2-manifest-2025-02-12.json (file inventory)
  📄 r2-backup-state.json (state tracking)
  📁 r2-files/ (actual files)
    📁 arb/
      📁 review/
        📄 ABC123-photo1.jpg
        📄 ABC123-photo2.jpg
    📁 vendors/
      📄 plumber-license.pdf
```

Check backup status on the backups page:
- Last R2 backup time
- Last Google Drive backup time

## Configuration Options

### Database Schema (`backup_config` table)

```sql
-- Enable/disable Google Drive backup
google_drive_enabled INTEGER DEFAULT 0

-- Google Drive folder ID
google_drive_folder_id TEXT

-- Schedule (daily or weekly)
schedule_type TEXT DEFAULT 'daily'
schedule_hour_utc INTEGER DEFAULT 2
schedule_day_of_week INTEGER  -- 0=Sunday, only used if weekly

-- What to include in Google Drive backup
include_r2_manifest INTEGER DEFAULT 1  -- Recommended: always 1
include_r2_files INTEGER DEFAULT 0     -- Set to 1 to enable incremental file backup
```

### Recommended Settings

**For most HOAs:**
- ✅ `include_r2_manifest`: 1 (always keep manifest)
- ✅ `include_r2_files`: 1 (enable incremental file backup)
- Schedule: Daily at 2:00 AM UTC

**For large HOAs (>5GB files):**
Consider weekly full backups instead of daily:
- Schedule: Weekly on Sunday at 2:00 AM UTC
- Still gets daily manifest (shows what exists)
- Full file backup once per week

**For minimal backup:**
- ✅ `include_r2_manifest`: 1 (keep manifest)
- ☐ `include_r2_files`: 0 (skip actual files)
- Only database + whitelist + file inventory backed up
- Actual files stay in R2 (rely on Cloudflare)

## Disaster Recovery

### Scenario: Complete Cloudflare Account Loss

With R2 file backup enabled, you have everything in Google Drive:

1. **Download backups from Google Drive**
   ```bash
   # Download using rclone or Drive desktop app
   rclone sync "gdrive:CLRHOA Backups" ~/clrhoa-recovery
   ```

2. **Restore database**
   ```bash
   # Decompress and import SQL
   gunzip 2025-02-12.sql.gz
   sqlite3 new_database.db < 2025-02-12.sql
   ```

3. **Restore files**
   - All files are in `r2-files/` folder with original structure
   - Upload to new R2 bucket or alternative storage

4. **Restore whitelist**
   - JSON file contains all authorized emails
   - Import into new KV namespace

### Scenario: Individual File Recovery

Need to restore a deleted file?

1. Check latest manifest: `r2-manifest-YYYY-MM-DD.json`
2. Find file in Drive: `r2-files/path/to/file.ext`
3. Download and restore

## Advanced Features

### Folder Structure Preservation

The system maintains your R2 folder structure in Google Drive:

**R2 Structure:**
```
arb/
  original/ABC123-photo.jpg
  review/ABC123-photo.jpg
  approved/ABC123-photo.jpg
vendors/
  plumber-license.pdf
compliance/
  budget-2025.pdf
```

**Google Drive Structure:**
```
r2-files/
  arb/
    original/ABC123-photo.jpg
    review/ABC123-photo.jpg
    approved/ABC123-photo.jpg
  vendors/
    plumber-license.pdf
  compliance/
    budget-2025.pdf
```

### Automatic Cleanup

The backup worker also cleans up old database records:
- Contact submissions > 1 year old
- Rate limit entries > 7 days old
- Directory logs > 1 year old

This keeps your database lean and fast.

### Retention Policy

**R2 Backups:**
- Default: 30 days retention
- Configurable via `BACKUP_RETENTION_DAYS` environment variable

**Google Drive Backups:**
- Keep 4 most recent
- Keep 1 per month for last 4 months
- Keep 1 yearly backup (31-365 days old)

## Troubleshooting

### First Backup Taking Long

**Normal!** First backup uploads all existing files.
- 500MB: ~5-10 minutes
- 2GB: ~20-30 minutes
- 5GB: ~1-2 hours

Subsequent backups are much faster (seconds to minutes).

### "Failed to upload file" Errors

Check:
1. Google Drive quota (15GB free tier limit)
2. OAuth token still valid (re-connect if needed)
3. File permissions in Drive folder

### Files Not Uploading

Verify configuration:
```bash
# Check backup config
npx wrangler d1 execute clrhoa_db --remote \
  --command "SELECT * FROM backup_config WHERE id = 1;"
```

Ensure:
- `google_drive_enabled = 1`
- `include_r2_files = 1`
- `google_refresh_token_encrypted` is set
- `google_drive_folder_id` is correct

### State File Corruption

If state file gets corrupted, delete it from Google Drive:
1. Next backup will treat it as "first backup"
2. Will re-upload all files (safe, just takes longer)
3. New state file will be created

## Performance Tips

### Optimize First Backup

1. **Run during off-hours**: Schedule first backup at night
2. **Use manual trigger**: Control when it happens
3. **Monitor progress**: Check Worker logs

### Reduce Backup Size

1. **Clean up old ARB requests**: Archive approved requests older than 2 years
2. **Remove duplicate files**: Check manifest for duplicates
3. **Compress large files**: Use image optimization for photos

### Speed Up Daily Backups

Daily backups are already optimized:
- Only new/changed files uploaded
- Parallel uploads (worker handles this)
- Efficient etag comparison

## Monitoring

### Check Last Backup Times

Visit `/board/backups` page to see:
- Last R2 backup timestamp
- Last Google Drive backup timestamp
- Manual download status

### View Worker Logs

```bash
# Tail worker logs
npx wrangler tail --config workers/backup/wrangler.toml

# View recent logs
npx wrangler tail --config workers/backup/wrangler.toml --format pretty
```

Look for:
- "R2 incremental backup: X uploaded, Y skipped"
- "R2 file backup complete: XMB transferred"
- "Uploaded R2 manifest for YYYY-MM-DD"

## Summary

The incremental R2 backup system provides:
- ✅ True off-site backup (files in Google Drive)
- ✅ Cost-effective (only new files transferred)
- ✅ Fast daily backups (seconds instead of minutes)
- ✅ Complete disaster recovery capability
- ✅ Automatic change detection
- ✅ Zero maintenance (runs automatically)

**First run**: One-time setup cost (upload all files)
**Daily runs**: Minimal cost and time (only new files)
**Peace of mind**: Priceless! 🎉
