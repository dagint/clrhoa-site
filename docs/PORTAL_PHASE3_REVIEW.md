# Phase 3 (Directory + Vendors) Review

This document reviews the Phase 3 directory and related portal features for correctness, security, and operations. It covers the `owners` table, `directory_logs`, Board Directory, Portal Directory, My Info, CSV upload, and profile-required flow.

---

## 1. What’s in scope

- **Schema:** `schema-phase3.sql` (owners, directory_logs, vendors), `schema-owners-phones.sql` (phones column), `schema-directory-logs-email.sql` (target_email for email reveal).
- **APIs:** `/api/owners`, `/api/owners/me`, `/api/owners/upload-csv`, `/api/log-phone-view`.
- **Pages:** Board Directory, Portal Directory, Portal My Info, Dashboard (profile redirect).

---

## 2. Correctness and behavior

### 2.1 Directory DB (`src/lib/directory-db.ts`)

- **IDs:** `generateId()` uses `crypto.getRandomValues` (21 chars). Safe for uniqueness.
- **Parameterized queries:** All DB access uses bound parameters; no SQL injection from user input.
- **directory_logs:** Insert is backward-compatible:
  - When only logging a **phone** reveal, the insert uses the original 5 columns (no `target_email`). Works even if `schema-directory-logs-email` has not been run.
  - When logging an **email** reveal, the insert includes `target_email`. **Requires** running `npm run db:directory-logs-email` (or `:local`) first; otherwise email reveal will fail at runtime.
- **Phones:** `getPhonesArray` supports both legacy `phone` and JSON `phones`; behavior is consistent.

### 2.2 Owners API (`/api/owners`)

- **Auth:** Session required; origin verified; CSRF on state-changing methods.
- **Roles:** GET/DELETE allowed for board, admin, arb. POST/PUT only for board and admin.
- **DELETE:** Accepts single `id` or array `ids`; duplicates are de-duplicated. **Limit:** 500 IDs per request to avoid abuse and long-running deletes.
- **Responses:** Success and error payloads are consistent and JSON.

### 2.3 Owners Me API (`/api/owners/me`)

- **GET:** Returns the current user’s owner row (by session email). No CSRF for read.
- **PUT:** CSRF required. Upserts by session email; user cannot change email (taken from session). **Phones:** Capped at 5 entries.

### 2.4 Upload CSV (`/api/owners/upload-csv`)

- **Auth:** Session + board/admin/arb; CSRF and origin checked.
- **File:** Must be sent as form field `file` or `csv`.
- **Limits:**
  - File size: 1 MB max.
  - Row count: 1,000 max.
- **Parsing:** Header row detected by presence of “name”, “email”, or “address”. Columns mapped case-insensitively. Quoted CSV fields supported.
- **Semantics:** Rows with email update existing owner by email or insert; rows without email insert only. Empty rows skipped. Errors per row are collected and returned; rest of the batch still applies.

### 2.5 Log phone/view email (`/api/log-phone-view`)

- **Auth:** Session; CSRF and origin checked.
- **Body:** `ownerId`, `csrf_token`, optional `reveal: 'phone' | 'email'`.
- **Behavior:** Loads owner by ID; if not found returns 404. For `reveal === 'email'` logs with `target_email` and returns `{ email }`; otherwise logs phone and returns `{ phone, phones }`. Unauthenticated users cannot see other owners’ contact data.

### 2.6 Profile redirect (all portal pages)

- **Logic:** In `ProtectedPage`, after session is validated, the app checks the current path. If the path is `/portal/login` or `/portal/my-info`, the profile check is skipped. Otherwise, if the owner row (by session email) is missing name, address, or at least one phone, the user is redirected to `/portal/my-info?required=1`.
- **No loop:** My Info and Login are excluded from the check, so the user can always reach My Info to complete their profile.
- **Scope:** Every portal page that uses `ProtectedPage` is protected. Login does not use ProtectedPage, so unauthenticated users are not affected.

### 2.7 My Info (view/edit and required)

- **View vs edit:** If profile is complete, the page shows view mode with an “Edit profile” button. If not, or if `?required=1`, it shows edit mode and (when `required=1`) the “Profile required” banner.
- **Save:** PUT to `/api/owners/me`; on success the view is updated and, when `required=1`, the user is redirected to the dashboard.

---

## 3. Security

### 3.1 Already in place

- **Session:** All directory/owner endpoints require a valid session.
- **CSRF:** All mutating endpoints (POST/PUT/DELETE, upload-csv, log-phone-view) verify CSRF token.
- **Origin:** `verifyOrigin(origin, referer, expectedOrigin)` is used on these APIs to reduce CSRF and cross-origin misuse.
- **Role checks:** Board/Admin/Arb for directory management and CSV upload; only board/admin for creating/editing individual owners.
- **Ownership:** `/api/owners/me` only reads/updates the row tied to `session.email`; no ID in URL.
- **Directory reveal:** Phone/email are only returned after auth and after logging the reveal; no unauthenticated access.

### 3.2 Adjustments made in this review

- **Bulk delete:** DELETE with `ids` is limited to 500 IDs per request to limit impact of abuse or mistakes.
- **CSV upload:** File size limited to 1 MB and row count to 1,000; rate limited (10 per hour per IP).
- **Phones array:** PUT `/api/owners/me` limits `phones` to 5 entries.
- **Directory reveal:** `/api/log-phone-view` (phone and email) rate limited to 60 per minute per IP.

### 3.3 Rate limiting (implemented)

- **CSV upload:** `/api/owners/upload-csv` — 10 requests per hour per IP.
- **Directory reveal:** `/api/log-phone-view` (phone and email reveal) — 60 requests per minute per IP.

See `src/lib/rate-limit.ts` and the endpoint handlers. **Rate limiting requires the `KV` binding** in `wrangler.toml` (a dedicated KV namespace, e.g. `RATE_LIMIT`). Setup: create the namespace with `npx wrangler kv namespace create RATE_LIMIT`, then set its id in `wrangler.toml` under the `KV` binding (replace `REPLACE_WITH_RATE_LIMIT_KV_ID`). If `KV` is not bound, the app runs but rate limits and login lockout are not enforced. See **docs/PORTAL_SETUP.md** (section 4b).

### 3.4 Directory logs — audit data and Florida law

- **Audit:** `directory_logs` is audit data recording who revealed which member’s phone or email and when.
- **Retention and access:** Retention and access for `directory_logs` should follow Florida law and the association’s record retention policy. Limit access to authorized personnel; use only for audit, disputes, or as required by law. See **docs/DIRECTORY_LOGS_AUDIT.md** for details and recommendations.

### 3.5 Other recommendations

- **Profile redirect** is implemented globally in `ProtectedPage`: incomplete profiles are redirected to `/portal/my-info?required=1` for all portal pages except login and my-info.

---

## 4. Scalability and performance

- **listOwners:** Returns up to **2,000** owners in one query (`LIST_OWNERS_MAX` in `directory-db.ts`), ordered by name. This caps response size and query cost. If the directory grows beyond 2,000, increase the constant or add pagination (e.g. `?page=1&limit=100`).
- **Profile check (ProtectedPage):** One indexed lookup by email (`getOwnerByEmail`) per protected page load. Lightweight and acceptable; no change needed unless traffic grows very large.
- **deleteOwners:** Loops over IDs (max 500 per request). Acceptable at current cap; for larger batches, consider a single `DELETE FROM owners WHERE id IN (...)` with bound list.
- **CSV:** One DB call per row; 1 MB / 1,000 row limits keep this bounded.

---

## 5. Migrations and deployment

- **Phase 3 base:** `npm run db:phase3` / `db:phase3:local` (owners, directory_logs, vendors).
- **Phones:** `npm run db:owners-phones` / `db:owners-phones:local` (adds `phones` to owners).
- **Email reveal:** `npm run db:directory-logs-email` / `db:directory-logs-email:local` (adds `target_email` to directory_logs). **Required for “Reveal email” in the directory.** Phone-only reveal works without this migration.
- **Owners created_at:** `npm run db:owners-created-at` / `db:owners-created-at:local` (adds `created_at` to owners). Optional; used for the dashboard “Recent updates” notice (new members in directory). If skipped, that notice shows only new vendors.

**Login allow list:** When a new owner is added (single add or CSV upload with email), their email is automatically added to the login whitelist (KV `CLOURHOA_USERS`) as a member so they can sign in. Existing whitelist entries (e.g. admin/board/arb) are never overwritten.

Run migrations in that order. For new environments, run all three (phase3, owners-phones, directory-logs-email) so all features work.

---

## 6. Summary

| Area              | Status | Notes                                                                 |
|-------------------|--------|-----------------------------------------------------------------------|
| Auth & CSRF       | OK     | Session, CSRF, and origin checks on all relevant endpoints.          |
| Roles             | OK     | Board/admin/arb for directory/delete/CSV; board/admin for add/edit.  |
| SQL injection     | OK     | Parameterized queries only.                                          |
| Bulk delete       | OK     | Capped at 500 IDs per request.                                        |
| CSV upload        | OK     | 1 MB and 1,000 row limits; rate limited; role and CSRF enforced.      |
| Phones (me)       | OK     | Capped at 5 entries.                                                 |
| directory_logs    | OK     | Backward-compatible for phone-only; email needs directory-logs-email. |
| Profile required  | OK     | Enforced on all portal pages (except login and my-info) via ProtectedPage. |
| Rate limiting     | OK     | Requires `KV` binding; see PORTAL_SETUP.md section 4b.                    |

Phase 3 directory and related behavior are in good shape. **Operational requirements:** (1) Run the `directory-logs-email` migration wherever “Reveal email” is used. (2) Bind a KV namespace as `KV` for rate limiting and login lockout (see **docs/PORTAL_SETUP.md**).
