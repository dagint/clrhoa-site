# Database Migrations

This directory contains SQL migration files for the D1 database.

## Running Migrations

### Production (Remote D1)

```bash
# Run a specific migration on production
wrangler d1 execute clrhoa_db --remote --file=scripts/migrations/<migration-file>.sql

# Example: Apply PIM elevation log table
wrangler d1 execute clrhoa_db --remote --file=scripts/migrations/add-pim-elevation-log-table.sql
```

### Local Development

```bash
# Run a specific migration locally
wrangler d1 execute clrhoa_db --local --file=scripts/migrations/<migration-file>.sql

# Example: Apply PIM elevation log table locally
wrangler d1 execute clrhoa_db --local --file=scripts/migrations/add-pim-elevation-log-table.sql
```

## Verifying Migrations

After running a migration, verify it was applied:

```bash
# Remote
wrangler d1 execute clrhoa_db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Local
wrangler d1 execute clrhoa_db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## Migration Files

| File | Description | Date | Status |
|------|-------------|------|--------|
| `add-users-id-column.sql` | Add id column to users table | 2026-02-14 | Applied |
| `add-owners-phones-column.sql` | Add phones column to owners table | 2026-02-14 | Applied |
| `fix-sessions-expires-at.sql` | Fix sessions expires_at column type | 2026-02-14 | Applied |
| `add-pim-elevation-log-table.sql` | Add PIM elevation audit log table | 2026-02-15 | Applied |
| `add-lot-number-to-sms-requests.sql` | Add lot_number column to sms_feature_requests | 2026-02-15 | ✅ **Applied** |
| `fix-site-feedback-schema-safe.sql` | Fix site_feedback schema (url/thumbs/comment) | 2026-02-15 | ✅ **Applied** |

### ✅ Migration Status

All required migrations have been successfully applied to both local and production databases as of 2026-02-15.

**Production fixes completed:**
- ✅ `site_feedback` table recreated with correct schema (url, thumbs, comment)
- ✅ `sms_feature_requests` table now has `lot_number` column

The following pages should now work without errors:
- https://www.clrhoa.com/portal/admin/feedback
- https://www.clrhoa.com/portal/admin/sms-requests

## Best Practices

1. **Always test locally first** before running on production
2. **Use `CREATE TABLE IF NOT EXISTS`** to make migrations idempotent
3. **Include rollback instructions** in migration comments when applicable
4. **Document the migration** in this README after applying
5. **Backup production data** before running destructive migrations

## Troubleshooting

### "Table already exists" error
If you get this error, the migration was likely already applied. Verify with:
```bash
wrangler d1 execute clrhoa_db --remote --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='<table_name>';"
```

### "No such database" error
Make sure you've created the D1 database:
```bash
wrangler d1 list
```

If it doesn't exist, create it:
```bash
wrangler d1 create clrhoa_db
```
