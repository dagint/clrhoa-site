# R2 File Backup Strategy

## Problem
- HOA has user-uploaded files in R2 (ARB requests, vendor documents, etc.)
- Want off-site backup (outside Cloudflare) to Google Drive
- Don't want to re-upload all files every day (slow, wasteful)

## Solution: Incremental Backup with Compressed Archives

### Approach A: Incremental File Sync (Most Efficient)

**How it works:**
1. Keep a `last_backup_state.json` file tracking what's in Google Drive
2. Each backup run:
   - List all R2 files
   - Compare with last_backup_state
   - Only upload NEW or CHANGED files (using etag/checksum)
   - Update state file

**Costs:**
- First run: Upload all existing files (one-time)
- Daily runs: Only upload files added/changed that day (typically 0-5 files)
- Example: If you get 2 new ARB requests/day with 5 photos each = 10 files/day
  - 10 files × 2MB avg = 20MB/day
  - 20MB × 30 days = 600MB/month (well within free tier)

**Implementation:**
```typescript
// Pseudo-code
const lastState = await getFromGoogleDrive('last_backup_state.json');
const currentFiles = await listAllR2Files();

const newOrChanged = currentFiles.filter(file =>
  !lastState[file.key] || lastState[file.key].etag !== file.etag
);

// Only upload these new/changed files
for (const file of newOrChanged) {
  await uploadToGoogleDrive(file);
}

// Save new state
await uploadToGoogleDrive('last_backup_state.json', currentFiles);
```

### Approach B: Weekly Compressed Archives (Most Organized)

**How it works:**
1. Create compressed archive IN R2 (server-side, free)
2. Split archive into chunks (e.g., 100MB each) if needed
3. Upload chunks to Google Drive
4. Keep archives by week

**Schedule:**
- Daily: Manifest only (JSON file listing all files)
- Weekly: Compressed archive of files added that week
- Monthly: Full compressed archive (all files), split into chunks

**Costs:**
- Daily: ~1KB manifest file (essentially free)
- Weekly: Only files from that week (incremental)
- Monthly: All files, but only once/month

**Implementation:**
```typescript
// Create archive in R2 first (no egress cost)
const archiveKey = `backups/r2-weekly/week-${weekNum}.tar.gz`;
await createR2Archive(filesToBackup, archiveKey);

// Split if needed (large archives)
if (archiveSize > 100MB) {
  const chunks = await splitArchive(archiveKey, 100MB);
  for (const chunk of chunks) {
    await uploadToGoogleDrive(chunk);
  }
} else {
  await uploadToGoogleDrive(archiveKey);
}
```

### Approach C: Manifest Only (Minimal)

**How it works:**
1. Daily: Upload only manifest.json (inventory of all files with metadata)
2. Files stay in R2 (Cloudflare)
3. For disaster recovery: use manifest to know what to restore, download from R2

**Costs:**
- Daily: ~100KB manifest file
- Essentially zero cost

**Trade-off:**
- ✅ Minimal cost and complexity
- ❌ Still relies on Cloudflare R2 for actual files
- ⚠️ In true disaster (Cloudflare account lost), you'd only have file list, not files

## Recommendation

**Start with Approach A (Incremental Sync):**

1. **First backup**: Upload all current files (one-time setup)
2. **Daily backups**: Only upload new/changed files
3. **Smart detection**: Use R2 etag (checksum) to detect changes
4. **State tracking**: Keep state file in both R2 and Google Drive

**Why this is best:**
- ✅ True off-site backup (files actually in Google Drive)
- ✅ Minimal daily overhead (only new files)
- ✅ No complicated archive/split logic needed
- ✅ Easy to restore (files are in Drive, ready to download)
- ✅ Cost-effective (R2 egress is free, only new files transferred)

**Then optionally add Approach B for long-term archival:**
- Keep incremental sync for recent files
- Create monthly compressed archives for long-term storage
- Delete old incremental files from Drive after archiving

## File Organization in Google Drive

```
📁 CLRHOA Backups (your folder: 1OMxrvjqkyiIPl6e5e-X2jMjF1eno4YVz)
  📄 2025-02-12.sql.gz (database)
  📄 whitelist-2025-02-12.json (users)
  📄 r2-manifest-2025-02-12.json (file inventory)
  📁 r2-files/ (actual files, mirroring R2 structure)
    📁 arb/
      📁 review/
        📄 ABC123-photo1.jpg
        📄 ABC123-photo2.jpg
    📁 vendors/
      📄 plumber-license.pdf
  📁 archives/ (optional: monthly compressed backups)
    📄 2025-02-full-part1.tar.gz
    📄 2025-02-full-part2.tar.gz
```

## Configuration Options

Add to backup_config table:
```sql
ALTER TABLE backup_config ADD COLUMN r2_backup_strategy TEXT DEFAULT 'incremental';
-- Options: 'incremental', 'weekly_archive', 'manifest_only'

ALTER TABLE backup_config ADD COLUMN r2_archive_chunk_size_mb INTEGER DEFAULT 100;
-- Split archives into chunks of this size

ALTER TABLE backup_config ADD COLUMN r2_full_backup_schedule TEXT DEFAULT 'monthly';
-- How often to do full archive: 'weekly', 'monthly', 'never'
```

## Next Steps

1. Choose strategy (recommend: incremental)
2. Implement incremental sync with state tracking
3. Test with current files
4. Monitor costs and adjust
5. Optionally add monthly archives later
