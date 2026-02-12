# Backup Strategy & Compliance

This document describes the backup strategy for the HOA portal: what we backup, where it goes, how to keep cost minimal, and how it supports recovery and Florida HOA compliance. It also outlines the implementation for **Cloudflare-only** backups and **Google Workspace Drive** backups configured in the portal.

---

## Goals

- **Data safety:** Protect D1 (database), critical KV (whitelist), and optionally R2 metadata.
- **Low cost:** Prefer Cloudflare-native storage (R2) and existing Google Workspace; avoid extra paid services.
- **Easy recovery:** Documented restore steps; backups in a format that can be restored with standard tools.
- **Compliance:** Support FL HOA record-keeping expectations (minutes, financial records, member data) with retention and off-site copy when needed.
- **Minimal size:** Backup only what’s needed for recovery; compress where helpful.

---

## What We Backup (Minimal Set)

| Data | Include? | Reason | Approx. size |
|------|----------|--------|---------------|
| **D1 (full DB)** | Yes | All app data: owners, ARB, assessments, meetings, feedback, etc. | One SQL dump; compress (e.g. gzip) for storage. |
| **KV – whitelist (CLOURHOA_USERS)** | Yes | Needed to restore who can log in and roles. | Small JSON. |
| **KV – SESSION** | No | Ephemeral; users re-login. | Skip. |
| **KV – rate limit (KV)** | No | Ephemeral; safe to lose. | Skip. |
| **R2 (file contents)** | Optional | Large; already durable in R2. For compliance, optional “manifest” (key list + sizes) or periodic full copy to Drive. | Manifest: small. Full: large. |

**Default for cost/size:** D1 dump (gzipped) + whitelist JSON. Optionally add R2 key manifest or “include R2 files” in Google Drive backup when the board enables it.

---

## Where Backups Go

1. **Cloudflare R2 (always, no extra bucket needed)**
   - Use a prefix in the existing `clrhoa-files` bucket (e.g. `backups/d1/`, `backups/kv/`) or a dedicated bucket `clrhoa-backups` if you prefer.
   - **Cost:** R2 storage is cheap; same account, no new service.
   - Retention: lifecycle rules or app logic (e.g. daily 7 days, weekly 4 weeks, monthly 12 months).

2. **Google Workspace Drive (optional, configured in portal)**
   - A Board or Admin sets a **Google Drive folder** in the portal and a **schedule** (e.g. daily 2:00 AM, weekly Sunday 2:00 AM).
   - Same artifacts (D1 dump + whitelist JSON, optionally R2 manifest or files) are uploaded to that folder.
   - **Cost:** Uses existing Google Workspace; no extra cost.
   - **Compliance:** Off-site copy under board control; retention managed in Drive (e.g. folder retention policies).

---

## Schedule (Portal-Configurable)

- **Cloudflare-only:** A cron Worker runs on a fixed schedule (e.g. daily); writes to R2 only.
- **With Google Drive:** When a board/admin has configured Drive backup in the portal, the same cron job also uploads the same backup set to the chosen Drive folder.
- **Options in portal UI:**
  - Enable/disable Google Drive backup.
  - Connect Google account (OAuth), pick or create folder (e.g. “HOA Backups”).
  - Schedule: Daily (with time) or Weekly (day + time).
  - Optional: “Include R2 file list” (manifest only) or “Include R2 files” (larger; for full compliance copy).

---

## Retention (Suggested)

- **In R2:**
  - Daily: keep 7 days.
  - Weekly: keep 4 weeks.
  - Monthly: keep 12 months.
  - (Optional) Yearly: keep longer for audit; can be manual or automated.
- **In Google Drive:**
  - Managed by the board (folder retention, delete old backups when no longer needed).
  - For FL HOA, keeping at least several years of key backups (e.g. monthly) is a reasonable practice for official records.

---

## Florida HOA Compliance Notes

- Florida HOAs are required to maintain certain records (e.g. meeting minutes, financial records, member list, covenants).
- **Reasonable practices:**
  - Regular automated backups of the database (D1) and critical config (whitelist).
  - Retention that allows recovery for at least the period required for official records (often several years for core records).
  - Off-site copy (e.g. Google Drive) so a single provider outage doesn’t remove the only copy.
- This strategy supports that by:
  - Backing up all structured data (D1) and login/role data (whitelist).
  - Offering an optional, board-controlled copy to Google Workspace.
  - Keeping retention configurable (R2 lifecycle + Drive folder management).
- **Disclaimer:** This is not legal advice. Confirm retention and record-keeping requirements with your HOA’s legal or compliance advisor.

---

## Implementation Plan

### Phase 1: Cloudflare-only automated backups (no new cost)

1. **Backup Worker (separate from Pages)**
   - Runs on cron (e.g. `0 2 * * *` daily 2 AM UTC).
   - Uses Cloudflare **D1 Export API** (POST to trigger export, poll until ready, fetch SQL via signed URL).
   - Optionally: list CLOURHOA_USERS KV and write a small JSON to R2.
   - Writes to R2: e.g. `backups/d1/YYYY-MM-DD.sql.gz`, `backups/kv/whitelist-YYYY-MM-DD.json`.
   - Requires: Worker with D1 + R2 bindings; **Cloudflare API token** (or use Workflows if available) to trigger D1 export, plus account ID.
   - **Note:** Workers cannot run `wrangler d1 export`; they must use the [D1 Export REST API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/) (trigger export, poll, then fetch result and upload to R2).

2. **R2 retention**
   - Lifecycle rules on the backup prefix (or bucket): delete objects older than 7 days for daily; or implement a small “cleanup” step in the Worker (e.g. list by prefix, delete older than N).

3. **Docs**
   - Update [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) with: where backups live in R2, how to download and restore D1/KV from R2.

### Phase 2: Portal UI – backup settings (Board/Admin only)

1. **New board page (e.g. `/board/backups`)**
   - Visible only to Board and Admin.
   - **Settings:**
     - Enable/disable “Backup to Google Drive”.
     - “Connect Google Drive”: starts OAuth flow (Google Cloud project with Drive API, OAuth consent).
     - After auth: “Choose folder” (Drive Picker or list recent folders); store **folder ID** and **refresh token** (encrypted at rest in D1 or as a secret).
     - Schedule: dropdown – Daily / Weekly; time (and day for weekly).
     - Optional checkbox: “Include R2 file list (manifest)” or “Include R2 files” (with warning about size).

2. **Storage of config**
   - New D1 table (e.g. `backup_config`): `id`, `google_refresh_token_encrypted`, `google_drive_folder_id`, `schedule_cron` or `schedule_type` + `schedule_time`, `include_r2_manifest`, `include_r2_files`, `updated_by`, `updated_at`.
   - Only one “active” config row (or one per backup type).
   - Secrets: encrypt refresh token with a key derived from `SESSION_SECRET` or a dedicated `BACKUP_ENCRYPTION_KEY` (wrangler secret).

### Phase 3: Worker uses portal config and uploads to Google Drive

1. **Cron Worker enhancement**
   - On each run:
     - Produce same artifacts as Phase 1 (D1 export → R2, KV whitelist → R2).
     - Query D1 for `backup_config` where Google Drive is enabled and schedule matches current time (e.g. “daily 2 AM” or “weekly Sunday 2 AM”).
     - If matched: using stored refresh_token, get Drive API access token; upload `YYYY-MM-DD.sql.gz` and `whitelist-YYYY-MM-DD.json` (and optionally R2 manifest or R2 file tarball) to the configured folder.
   - Use Google Drive API v3 (multipart upload for larger files).
   - Worker needs: **Google OAuth client ID + secret** (wrangler secrets) and logic to refresh tokens.

2. **Size control**
   - D1: always gzipped.
   - R2: “Include R2 files” only when explicitly enabled; consider excluding very large prefixes or limiting to `arb/`, `member-docs/`, etc.

### Phase 4: Recovery and testing

- **Recovery:** Document in BACKUP_AND_RECOVERY.md: how to download from R2 and from Google Drive; how to restore D1 from `.sql.gz`; how to re-import whitelist into KV.
- **Testing:** Quarterly test: restore from a backup into a staging D1, run smoke checks.
- **Monitoring:** Optional: Worker posts to a webhook or logs a metric on failure; board can get notified if backup fails.

---

## Summary

| Aspect | Choice |
|--------|--------|
| **What** | D1 (full) + KV whitelist; optional R2 manifest or full R2 copy. |
| **Where (Cloudflare)** | R2 prefix or bucket; retention via lifecycle or Worker. |
| **Where (off-site)** | Google Workspace Drive folder, chosen in portal. |
| **Schedule** | Cron Worker; schedule configurable in portal for Drive. |
| **Cost** | R2 storage (minimal); no new services; Google Drive uses existing Workspace. |
| **Compliance** | Supports FL HOA record-keeping with retention and off-site copy. |
| **Recovery** | Restore D1 from SQL dump; re-import whitelist; R2 already durable or restore from Drive if needed. |

Next step: implement Phase 1 (Worker + R2), then Phase 2 (portal UI and config), then Phase 3 (Drive upload in Worker).
