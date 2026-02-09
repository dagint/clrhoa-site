# Backup & Recovery Procedures

This document outlines backup and recovery procedures for the HOA portal. For **strategy, compliance, and implementation plan** (what to backup, Cloudflare R2 vs Google Drive, scheduling, FL HOA notes), see [BACKUP_STRATEGY_AND_COMPLIANCE.md](./BACKUP_STRATEGY_AND_COMPLIANCE.md).

## Database Backups (D1)

### Manual Backup

**Local:**
```bash
npm run db:backup:local
# or
./scripts/backup-d1.sh local
```

**Remote (Production):**
```bash
npm run db:backup
# or
./scripts/backup-d1.sh remote
```

Backups are saved to `backups/d1-backup-YYYYMMDD-HHMMSS.sql`.

### Automated Backups (Cloudflare + optional Google Drive)

Automated backups are implemented by a **separate Cloudflare Worker** with a cron trigger (see [BACKUP_STRATEGY_AND_COMPLIANCE.md](./BACKUP_STRATEGY_AND_COMPLIANCE.md)):

1. **Cloudflare R2:** The Worker uses the D1 Export REST API (trigger export → poll → fetch SQL), then uploads the dump (gzipped) to R2 under a backup prefix (e.g. `backups/d1/`). KV whitelist can be dumped to a small JSON and stored in R2 as well. Workers cannot run `wrangler d1 export`; they must use the [D1 Export API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/).
2. **Google Workspace Drive (optional):** A Board or Admin configures backup in the portal (**Board → Backups**): connects Google Drive (OAuth), selects a folder, and sets a schedule (e.g. daily 2 AM, weekly Sunday). The same Worker then uploads the same backup set (D1 + whitelist, optionally R2 manifest) to that Drive folder. Keeps size minimal and uses your existing Google Workspace.
3. **Retention:** Worker deletes backups older than `BACKUP_RETENTION_DAYS` (default 30). Drive retention is managed by the board in the chosen folder.

**Deploy the backup Worker:** From project root run `npm run backup:deploy`. Set secrets and vars in `workers/backup/wrangler.toml`: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_BACKUP_API_TOKEN` (secret), and for Google Drive: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKUP_ENCRYPTION_KEY` (secrets).

**Board/Admin: download full backup to your computer:** Go to **Board → Backups** and click **Download backup (ZIP)**. The ZIP contains the current D1 SQL dump and KV whitelist JSON. The main app needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_BACKUP_API_TOKEN` (and optionally `D1_DATABASE_ID`) in env for this to work.

### Restore from Backup

**Local:**
```bash
npx wrangler d1 execute clrhoa_db --local --file=backups/d1-backup-YYYYMMDD-HHMMSS.sql
```

**Remote:**
```bash
npx wrangler d1 execute clrhoa_db --remote --file=backups/d1-backup-YYYYMMDD-HHMMSS.sql
```

⚠️ **Warning**: Restoring will overwrite existing data. Always backup current state before restoring.

## File Storage Backups (R2)

### R2 Versioning

Enable versioning on the `clrhoa-files` bucket:

1. Go to Cloudflare Dashboard → R2 → clrhoa-files
2. Settings → Object Lifecycle
3. Enable versioning

### R2 Lifecycle Policies

Set up lifecycle policies to:
- Keep non-current versions for 90 days
- Delete old versions automatically

**Recommended Policy:**
- Non-current versions: Delete after 90 days
- Incomplete multipart uploads: Delete after 7 days

### Manual R2 Backup

To backup specific files or prefixes:

```bash
# List all ARB files
npx wrangler r2 object list clrhoa-files --prefix="arb/"

# Download specific file
npx wrangler r2 object get clrhoa-files --key="arb/REQUEST_ID/originals/file.jpg" --file="backup-file.jpg"
```

## Recovery Procedures

### Database Corruption

1. **Identify the issue**: Check error logs and database queries
2. **Stop writes**: If possible, temporarily disable write operations
3. **Restore from backup**: Use the most recent backup before corruption
4. **Verify data**: Check that restored data is correct
5. **Resume operations**: Re-enable write operations

### Accidental Deletion

1. **Check audit log**: Review `arb_audit_log` to identify what was deleted
2. **Restore from backup**: Use backup from before deletion
3. **Selective restore**: If only specific records were deleted, restore only those

### File Loss

1. **Check R2 versioning**: If enabled, restore from previous version
2. **Check backups**: Restore from R2 backup if available
3. **Re-upload**: If files are lost, request owners to re-upload

### Restoring from R2 or Google Drive backups

- **D1:** Download the `.sql.gz` from R2 (Dashboard or `wrangler r2 object get`) or from the Google Drive backup folder. Decompress, then run `npx wrangler d1 execute clrhoa_db --remote --file=path/to/backup.sql` (see Restore from Backup above). Restoring overwrites existing data; back up the current DB first if needed.
- **KV whitelist:** If you have `whitelist-YYYY-MM-DD.json`, use a small script or Worker to re-put keys into the `CLOURHOA_USERS` KV namespace. Document the JSON shape in the backup Worker so restore is repeatable.
- **R2 files:** If you only backed up a manifest, R2 originals are still in place. If you backed up full R2 to Drive, restore by uploading from Drive back to R2 (or a new bucket) and updating any key references if needed.

## Backup Retention Policy

- **Daily backups**: Keep for 7 days
- **Weekly backups**: Keep for 4 weeks
- **Monthly backups**: Keep for 12 months
- **Yearly backups**: Keep indefinitely (for legal/audit purposes)

## Testing Recovery

**Quarterly Recovery Test:**

1. Create a test database
2. Restore from a recent backup
3. Verify data integrity
4. Test critical workflows
5. Document any issues

## Backup Storage Locations

- **Local backups**: `backups/` directory (gitignored) — from manual `npm run db:backup` / `backup-d1.sh`.
- **Remote backups (Cloudflare)**: R2 prefix e.g. `backups/d1/` and `backups/kv/` in the main bucket, or a dedicated `clrhoa-backups` bucket. No extra cost beyond R2 storage.
- **Off-site backups**: Google Workspace Drive folder chosen in the portal (Board → Backups). Uses existing Workspace; retention managed by the board.

## Monitoring

Set up alerts for:
- Failed backup jobs
- Backup storage quota warnings
- Unusual backup sizes (may indicate data issues)

## Notes

- D1 backups are SQL dumps and can be restored to any SQLite-compatible database
- R2 backups should include both object data and metadata
- Test restore procedures regularly to ensure they work
- Document any custom recovery procedures for your specific setup
