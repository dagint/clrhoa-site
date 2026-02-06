# Backup & Recovery Procedures

This document outlines backup and recovery procedures for the ARB portal.

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

### Automated Backups

Cloudflare D1 supports scheduled backups via Workers cron triggers. To set up:

1. Create a Worker with a cron trigger
2. Use `wrangler d1 export` command in the Worker
3. Store backups in R2 or another storage service

**Example Worker (for future implementation):**
```javascript
export default {
  async scheduled(event, env, ctx) {
    // Export D1 database
    // Upload to R2 backup bucket
  }
}
```

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

- **Local backups**: `backups/` directory (gitignored)
- **Remote backups**: R2 bucket `clrhoa-backups` (recommended)
- **Off-site backups**: Consider additional storage for disaster recovery

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
