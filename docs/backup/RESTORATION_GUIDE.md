# Complete Disaster Recovery Guide

**Last Updated:** 2026-02-12

This guide covers complete restoration from backups stored in R2.

## 📦 What's Backed Up

Daily automated backups (2:00 AM UTC) include:

1. **D1 Database** (`backups/d1/YYYY-MM-DD.sql.gz`) - All tables, data, schema
2. **KV Whitelist** (`backups/kv/whitelist-YYYY-MM-DD.json`) - Email login whitelist
3. **R2 Files** (`backups/r2/YYYY-MM-DD/...`) - All uploaded files (ARB photos, documents, PDFs)
4. **R2 Manifest** (`backups/r2/YYYY-MM-DD/manifest.json`) - File inventory with checksums

**Retention:** 30 days (configurable in `workers/backup/wrangler.toml`)

---

## 🚨 Complete Disaster Recovery

### Scenario: Total Loss (D1 + R2 + KV destroyed)

#### Step 1: Restore D1 Database

```bash
# 1. Download latest D1 backup
npx wrangler r2 object get clrhoa-files/backups/d1/2026-02-12.sql.gz \
  --file backup.sql.gz

# 2. Extract SQL file
gunzip backup.sql.gz

# 3. Restore to D1 (creates all tables and data)
npx wrangler d1 execute clrhoa_db --remote --file backup.sql

# 4. Verify restoration
npx wrangler d1 execute clrhoa_db --remote \
  --command "SELECT COUNT(*) as user_count FROM users"
```

#### Step 2: Restore KV Whitelist

```bash
# 1. Download KV backup
npx wrangler r2 object get clrhoa-files/backups/kv/whitelist-2026-02-12.json \
  --file whitelist.json

# 2. Restore each entry (use script below)
node scripts/restore-kv-whitelist.js whitelist.json
```

**Create `scripts/restore-kv-whitelist.js`:**
```javascript
// Restore KV whitelist from backup JSON
import fs from 'fs';
import { execSync } from 'child_process';

const backupFile = process.argv[2];
if (!backupFile) {
  console.error('Usage: node restore-kv-whitelist.js <backup.json>');
  process.exit(1);
}

const whitelist = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
let restored = 0;

for (const [email, value] of Object.entries(whitelist)) {
  try {
    execSync(
      `echo "${value}" | npx wrangler kv:key put "${email}" --binding=CLOURHOA_USERS --preview false`,
      { stdio: 'inherit' }
    );
    restored++;
    console.log(`✓ Restored: ${email}`);
  } catch (err) {
    console.error(`✗ Failed: ${email}`, err.message);
  }
}

console.log(`\nRestored ${restored}/${Object.keys(whitelist).length} whitelist entries`);
```

#### Step 3: Restore R2 Files

```bash
# 1. Download manifest to see what files exist
npx wrangler r2 object get clrhoa-files/backups/r2/2026-02-12/manifest.json \
  --file r2-manifest.json

# 2. Review manifest (shows all backed up files)
cat r2-manifest.json | jq '.total_files, .total_bytes'

# 3. Restore all files (use script below)
node scripts/restore-r2-files.js r2-manifest.json
```

**Create `scripts/restore-r2-files.js`:**
```javascript
// Restore R2 files from backup location to original paths
import fs from 'fs';
import { execSync } from 'child_process';

const manifestFile = process.argv[2];
if (!manifestFile) {
  console.error('Usage: node restore-r2-files.js <manifest.json>');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
console.log(`Restoring ${manifest.total_files} files (${(manifest.total_bytes / 1024 / 1024).toFixed(2)} MB)...`);

let restored = 0;
for (const file of manifest.files) {
  try {
    // Copy from backup location back to original path (server-side copy)
    execSync(
      `npx wrangler r2 object get clrhoa-files/${file.backup_key} --file temp.bin && ` +
      `npx wrangler r2 object put clrhoa-files/${file.key} --file temp.bin`,
      { stdio: 'pipe' }
    );
    restored++;
    if (restored % 10 === 0) {
      console.log(`Progress: ${restored}/${manifest.total_files} files restored`);
    }
  } catch (err) {
    console.error(`✗ Failed to restore: ${file.key}`, err.message);
  }
}

// Cleanup
try { fs.unlinkSync('temp.bin'); } catch {}
console.log(`\n✓ Restored ${restored}/${manifest.total_files} files`);
```

---

## 📋 Partial Recovery Scenarios

### Restore Just Database
See Step 1 above.

### Restore Just Files
See Step 3 above.

### Restore to Specific Date
Replace `2026-02-12` with desired backup date (YYYY-MM-DD format).

---

## 🔍 Verify Backup Integrity

```bash
# Check latest backups exist
npx wrangler r2 object list clrhoa-files --prefix backups/d1/ | tail -5
npx wrangler r2 object list clrhoa-files --prefix backups/kv/ | tail -5

# View R2 manifest
npx wrangler r2 object get clrhoa-files/backups/r2/2026-02-12/manifest.json \
  --file - | jq .

# Check backup sizes
npx wrangler d1 execute clrhoa_db --remote \
  --command "SELECT last_r2_backup_at FROM backup_config WHERE id = 1"
```

---

## ⚠️ Important Notes

1. **Test Restoration Regularly**
   - Perform quarterly test restores to a dev environment
   - Verify all file types open correctly
   - Check database integrity after restore

2. **Backup the Backups**
   - Enable Google Drive sync for off-site copy
   - Download critical backups locally monthly
   - Keep at least one backup outside Cloudflare

3. **Monitor Backup Status**
   - Check `/board/backups` page weekly
   - Verify `last_r2_backup_at` timestamp is recent
   - Alert if backup older than 48 hours

4. **Security**
   - Backups contain PII (user emails, addresses, etc.)
   - Secure downloaded backups with encryption
   - Delete local copies after testing

---

## 🆘 Emergency Contacts

If you need help with restoration:
1. Check Cloudflare D1/R2 status: https://www.cloudflarestatus.com
2. Review worker logs: `npx wrangler tail clrhoa-backup`
3. Create GitHub issue with error details

---

## 📊 Backup Storage Requirements

Typical backup sizes (estimate for 100 homeowners):
- D1 Database: ~1-5 MB compressed
- KV Whitelist: < 10 KB
- R2 Files: Varies by usage (10 MB - 10 GB)
- Total per day: ~100 MB - 1 GB
- 30-day retention: ~3 GB - 30 GB

**Cloudflare R2 Free Tier:** 10 GB storage (should be sufficient)
