# Incremental R2 Backup Implementation Summary

## What Was Implemented

### Core Features

1. **Incremental File Backup**
   - Only uploads NEW or CHANGED files to Google Drive
   - Uses etag (checksum) for change detection
   - Maintains state file (`r2-backup-state.json`) in Google Drive
   - First backup: uploads all files (one-time)
   - Subsequent backups: only new/changed files (fast!)

2. **R2 File Manifest**
   - JSON inventory of all uploaded files
   - Includes metadata: filename, size, etag, upload date
   - Always generated, optionally uploaded to Google Drive
   - Lightweight (~100KB for 1000 files)

3. **Automatic Data Cleanup**
   - Deletes contact_submissions older than 1 year
   - Deletes rate_limits older than 7 days
   - Deletes directory_logs older than 1 year
   - Runs during each backup to keep database lean

4. **Folder Structure Preservation**
   - Mirrors R2 folder structure in Google Drive
   - Creates nested folders automatically
   - Example: `arb/review/file.jpg` → `r2-files/arb/review/file.jpg`

5. **Smart State Tracking**
   - Tracks all files and their etags
   - Detects new files (not in state)
   - Detects changed files (different etag)
   - Skips unchanged files (same etag)
   - Updates state after successful backup

### Files Modified

1. **workers/backup/src/index.ts**
   - Added `R2FileMetadata` and `R2BackupState` interfaces
   - Added `listAllR2Files()` - List all user-uploaded files
   - Added `cleanupOldData()` - Clean old database records
   - Added `getR2BackupState()` - Get last backup state from Drive
   - Added `saveR2BackupState()` - Save current state to Drive
   - Added `uploadR2FilesToDrive()` - Incremental file upload
   - Added `getOrCreateDriveFolder()` - Nested folder creation
   - Modified `runBackup()` - Generate R2 manifest + cleanup
   - Modified `maybeUploadToGoogleDrive()` - Upload manifest and R2 files

2. **src/pages/board/backups.astro**
   - Added UI checkboxes for `include_r2_manifest` and `include_r2_files`
   - Added helpful descriptions for each option
   - Updated JavaScript to load/save new configuration fields
   - Added note explaining incremental backup behavior

3. **package.json**
   - Added `db:backup-config-r2-files` script
   - Added `db:backup-config-r2-files:local` script
   - Removed `contact-cleanup:deploy` script (worker consolidated)

4. **scripts/schema-backup-config-r2-files.sql**
   - Migration to add `include_r2_manifest` column (default 1)
   - Migration to add `include_r2_files` column (default 0)
   - Note: Migration already run in production (columns exist)

### Files Created

1. **docs/R2_BACKUP_STRATEGY.md**
   - Comprehensive strategy document
   - Compares 3 approaches (incremental, archives, manifest-only)
   - Explains cost analysis
   - Recommends incremental approach

2. **docs/R2_INCREMENTAL_BACKUP_GUIDE.md**
   - Complete user guide
   - Setup instructions
   - Cost analysis with examples
   - Disaster recovery procedures
   - Troubleshooting guide
   - Performance tips

3. **scripts/download-r2-backup.sh**
   - Shell script to download all R2 files locally
   - Alternative to Google Drive backup
   - Uses wrangler commands

## How It Works

### Backup Flow

```
Daily at 2:00 AM UTC:
1. Export D1 database → backups/d1/YYYY-MM-DD.sql.gz
2. Dump KV whitelist → backups/kv/whitelist-YYYY-MM-DD.json
3. List all R2 files → Generate manifest → backups/manifests/r2-manifest-YYYY-MM-DD.json
4. Clean up old database records (contact_submissions, rate_limits, directory_logs)
5. Apply R2 retention (delete backups older than 30 days)

If Google Drive enabled:
6. Upload D1 database to Google Drive
7. Upload KV whitelist to Google Drive
8. If include_r2_manifest: Upload manifest to Google Drive
9. If include_r2_files:
   a. Get last backup state from Drive (r2-backup-state.json)
   b. List current R2 files
   c. Compare with state (find new/changed files)
   d. Upload only new/changed files to Drive (in r2-files/ folder)
   e. Save new state to Drive
10. Apply Google Drive retention (4 recent, 4 monthly, 1 yearly)
11. Record last backup times in database
```

### State Tracking Example

**First Backup (2025-02-10):**
```json
{
  "lastBackupDate": "2025-02-10",
  "files": {
    "arb/review/ABC123-photo1.jpg": {
      "etag": "abc123...",
      "size": 2048576,
      "uploaded": "2025-02-09T10:00:00Z"
    },
    "arb/review/ABC123-photo2.jpg": {
      "etag": "def456...",
      "size": 1839452,
      "uploaded": "2025-02-09T10:01:00Z"
    }
  },
  "totalFiles": 200,
  "totalBytes": 524288000
}
```
**Action**: Upload all 200 files

**Second Backup (2025-02-11):**
- New file added: `arb/review/XYZ789-photo1.jpg`
- File changed: `vendors/plumber-license.pdf` (different etag)
- 198 files unchanged (same etag)

**Action**: Upload 2 files (1 new + 1 changed)

## Performance Characteristics

### First Backup
- **Files**: All existing files (e.g., 200 files, 500MB)
- **Time**: ~5-10 minutes
- **Bandwidth**: 500MB egress (FREE from R2)
- **Operations**: 200 R2 reads ($0.000072)

### Daily Backup (Typical)
- **Files**: 2-3 new ARB requests = 10 files, 20MB
- **Time**: ~30 seconds
- **Bandwidth**: 20MB egress (FREE)
- **Operations**: 10 R2 reads ($0.0000036)

### Monthly Cost
- **R2 Storage**: 1GB × $0.015 = $0.015
- **R2 Operations**: 300 reads × $0.36/million = $0.000108
- **R2 Egress**: FREE
- **Total**: ~$0.02/month (essentially free!)

## Configuration

### Database Settings

```sql
-- Enable Google Drive backup
UPDATE backup_config SET google_drive_enabled = 1 WHERE id = 1;

-- Set folder ID
UPDATE backup_config SET google_drive_folder_id = '1OMxrvjqkyiIPl6e5e-X2jMjF1eno4YVz' WHERE id = 1;

-- Enable R2 manifest (recommended)
UPDATE backup_config SET include_r2_manifest = 1 WHERE id = 1;

-- Enable R2 file backup (incremental)
UPDATE backup_config SET include_r2_files = 1 WHERE id = 1;
```

### Environment Variables (Worker)

Already configured:
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `BACKUP_ENCRYPTION_KEY` - For encrypting refresh token

## Testing

### Test Incremental Backup

1. **Initial state**: Ensure you have some files in R2
2. **Enable R2 file backup**: Check the box in UI
3. **Trigger first backup**:
   ```bash
   npx wrangler deploy --config workers/backup/wrangler.toml --test-scheduled
   ```
4. **Check Google Drive**: Should see `r2-files/` folder with all files
5. **Upload a new file**: Create a new ARB request with photo
6. **Trigger second backup**: Wait for scheduled run or trigger manually
7. **Verify incremental**: Check logs for "X uploaded, Y skipped"

### Expected Log Output

```
R2 incremental backup: 10 new/changed files out of 200 total
Uploaded R2 manifest for 2025-02-12
Uploading: arb/review/ABC123-photo1.jpg
Uploading: arb/review/ABC123-photo2.jpg
... (10 files total)
R2 file backup complete: 10 uploaded, 190 skipped, 20MB transferred
```

## Next Steps

1. **Complete OAuth** (if not done):
   - Visit https://clrhoa.com/board/backups
   - Click "Connect Google Drive"

2. **Enable R2 file backup**:
   - Check "R2 file manifest" (recommended)
   - Check "R2 actual files" (for incremental backup)
   - Save settings

3. **Trigger first backup**:
   - Option A: Wait for 2:00 AM UTC
   - Option B: Trigger manually via wrangler

4. **Monitor**:
   - Check Google Drive folder
   - View logs: `npx wrangler tail --config workers/backup/wrangler.toml`
   - Check backup status on `/board/backups` page

## Benefits

✅ **True off-site backup** - Files outside Cloudflare in Google Drive
✅ **Cost-effective** - Only new files transferred, R2 egress is FREE
✅ **Fast** - Incremental backups take seconds, not minutes
✅ **Automatic** - Runs daily, no manual intervention
✅ **Smart** - Detects changes via etag, avoids re-uploading
✅ **Complete** - Database + files + metadata all backed up
✅ **Disaster-proof** - Full recovery possible from Google Drive alone
✅ **Transparent** - State tracking shows exactly what's backed up

## Summary

This implementation provides:
- **Incremental R2 file backup** (only new/changed files)
- **Smart state tracking** (etag-based change detection)
- **Folder structure preservation** (mirrors R2 in Drive)
- **Automatic cleanup** (keeps database lean)
- **Cost-effective** (essentially free with R2 egress)
- **Fast** (seconds for daily backups after initial run)
- **Complete** (full disaster recovery capability)

The first backup uploads all existing files (one-time cost), and all subsequent backups only upload new or changed files, making daily backups fast and efficient.
