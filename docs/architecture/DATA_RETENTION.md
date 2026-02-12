# Data retention and Florida (FL) alignment

This doc summarizes retention behavior for the HOA portal and how it relates to Florida law. **This is not legal advice;** confirm with your counsel.

## Florida (FL) context

Under **Fla. Stat. 720.303** (official records of the association):

- **Meeting minutes** (board and members): retain **at least 7 years**.
- **Insurance policies**: retain **at least 7 years**.
- **Structural integrity reserve studies**: retain **at least 15 years** after completion.
- **Voting records** (ballots, sign-in sheets, proxies): retain **1 year** after the election or meeting.
- **Bids for work**: retain **1 year**.
- **Other official records**: the statute requires maintaining official records for specified periods; the full list is in the statute.

**Maintenance work orders / repair requests** are not explicitly listed in the statute. The 7-year rule applies to categories like minutes and insurance, not necessarily to routine work-order records. Retaining completed maintenance for **1 year** is a conservative, storage-reducing choice that aligns with the 1-year bid retention; you can shorten or extend after consulting counsel.

## What this app retains and deletes

| Data | Retention | How | FL note |
|------|-----------|-----|--------|
| **ARB requests** (approved/rejected) | 7 years | Soft-delete after 7 years (`deleted_at` set) | Aligns with 7-year official records. |
| **ARB requests** (cancelled, pending, in_review) | 1 year | Soft-delete after 1 year | Not “official records” in the 7-year sense. |
| **ARB audit log** | 7 years | Soft-delete old rows | Supports audit trail. |
| **Maintenance requests** (status = completed) | **Photos:** 1 year. **Metadata:** 7 years (optional). | **Photo purge:** After 1 year, R2 images are deleted and the `photos` column is cleared; the row (category, description, status, vendor, dates) is kept. **Row delete:** Optionally delete the row after 7 years. | Images drive cost; metadata is small. FL does not mandate work-order retention. |
| **Maintenance requests** (reported, in_progress) | Kept | No automatic deletion | Active work. |
| **Vendor submissions** (approved/rejected) | No automatic retention | Manual/board only | Consider adding retention if desired. |
| **Feedback responses** | No automatic retention | Manual/board only | — |
| **Meeting minutes / member documents** | No automatic retention in app | Stored until board deletes | FL: minutes 7 years; keep externally if needed. |

## Reducing closed maintenance storage (images vs metadata)

- **Images (R2):** To control cost, completed maintenance **photos** are removed after **1 year** (`MAINTENANCE_PHOTOS_RETENTION_DAYS`). The retention job deletes the R2 objects and sets the row’s `photos` column to null. **Metadata is kept** (category, description, status, vendor_assigned, created, updated).
- **Metadata (rows):** Rows are small. You can keep them indefinitely or delete after a long period (e.g. **7 years**, `MAINTENANCE_METADATA_RETENTION_DAYS`). Set to `0` to never delete rows.
- **Run the retention job** so that:
  1. **`purgeOldCompletedMaintenancePhotos(db, r2)`** runs regularly (e.g. weekly) — clears images after 1 year, keeps metadata.
  2. **`deleteOldCompletedMaintenance(db, { r2 })`** runs with the long retention (7 years) if you want to eventually remove very old rows. See `scripts/apply-retention-policies.ts` and the example Worker there.

## Other areas you might consider

- **Vendor submissions**: If you want to limit how long approved/rejected submissions are kept, add a similar retention step (e.g. delete or anonymize after X years). FL does not specify a period for these.
- **Login/audit logs**: Directory reveal logs, login history, etc. are kept as implemented; you could add retention (e.g. delete after 1–2 years) if desired.
- **Backups**: Backup retention (e.g. 30 days in R2) is separate and documented in BACKUP_AND_RECOVERY.md / BACKUP_STRATEGY_AND_COMPLIANCE.md.

## Running retention

- **ARB + audit**: `applyRetentionPolicies(db)`, `softDeleteOldAuditLogs(db)`.
- **Maintenance**: `deleteOldCompletedMaintenance(db, { r2 })` (pass R2 so photos are removed).
- Optional: `permanentlyDeleteOldRecords(db)` to permanently remove soft-deleted ARB/audit rows after a grace period (e.g. 30 days).

See `src/lib/data-retention.ts` and the example in `scripts/apply-retention-policies.ts` for a single Worker cron that runs all of the above.
