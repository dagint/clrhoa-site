# Portal / Member-Side Production Deployment Checklist

Use this checklist for the **first production deployment of the portal** (member-only side). The public site is already deployed; this ensures the portal, login, Board, and APIs work correctly.

**References:** [DEPLOYMENT_PORTAL_PRODUCTION.md](./DEPLOYMENT_PORTAL_PRODUCTION.md) (narrative guide), [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) (full env list).

---

## 1. Cloudflare resources (D1, KV, R2)

Create these in the same account as your Pages project. If they already exist (e.g. from staging), reuse them and note the IDs.

- [ ] **D1:** `npx wrangler d1 create clrhoa_db` → copy **database_id**
- [ ] **KV (allow list):** `npx wrangler kv namespace create clrhoa_users` → copy **id**
- [ ] **KV (sessions):** `npx wrangler kv namespace create SESSION` → copy **id**
- [ ] **KV (rate limiting):** `npx wrangler kv namespace create RATE_LIMIT` → copy **id**
- [ ] **R2:** `npx wrangler r2 bucket create clrhoa-files` (bucket name is the identifier; no id to copy)

**Why rate-limit KV matters:** Login lockout and API rate limits (login, ARB uploads, directory reveals, feedback, etc.) use the `KV` binding. Without it, rate limiting degrades gracefully (allows requests) but you lose protection.

---

## 2. wrangler.toml (Pages project)

Update placeholders so deploys and local production preview use the right resources.

- [ ] **D1:** Set `database_id` under `[[d1_databases]]` (binding `DB`)
- [ ] **KV CLOURHOA_USERS:** Set `id` for the allow-list namespace
- [ ] **KV SESSION:** Set `id` for the session namespace
- [ ] **KV (rate limit):** Replace `REPLACE_WITH_RATE_LIMIT_KV_ID` with the **RATE_LIMIT** namespace id; binding name must be `KV`
- [ ] **R2:** `bucket_name = "clrhoa-files"` (no id)

---

## 3. D1 migrations (production)

Run all migrations against **remote** D1 so tables exist before first deploy.

- [ ] From repo root: `npm run db:remote:all`
- [ ] If a step fails with “table/column already exists,” that migration is already applied; script continues. Fix any other errors before deploying.

---

## 4. Pages: bindings

In **Cloudflare Dashboard → Workers & Pages → [your Pages project] → Settings → Bindings**:

- [ ] **D1:** Bind database `clrhoa_db` as **`DB`**
- [ ] **KV:** Bind namespace (allow list) as **`CLOURHOA_USERS`**
- [ ] **KV:** Bind namespace (sessions) as **`SESSION`**
- [ ] **KV:** Bind namespace (rate limit) as **`KV`**
- [ ] **R2:** Bind bucket `clrhoa-files` as **`CLOURHOA_FILES`**

If you deploy with `wrangler pages deploy` and the project uses this `wrangler.toml`, bindings may be applied from config; confirm in the dashboard that all five match.

---

## 5. Pages: environment variables and secrets

Configure under **Workers & Pages → [your project] → Settings → Environment variables**. Use **Production** (and optionally Preview). Mark secrets as **Encrypt**.

### 5.1 Required for portal login

- [ ] **SESSION_SECRET** — **Secret** (Encrypt). Long random string (32+ characters). Without it, no one can log in.

### 5.2 Deployment / notification emails (recommended for portal)

- [ ] **NOTIFY_BOARD_EMAIL** — Board notifications (e.g. ARB submissions, maintenance, directory abuse)
- [ ] **NOTIFY_ARB_EMAIL** — ARB-specific notifications
- [ ] **NOTIFY_NOREPLY_EMAIL** — From address for outgoing email (e.g. `noreply@clrhoa.com`)

### 5.3 Email provider (Resend or MailChannels)

Choose one; Resend is recommended (free tier).

**Option A – Resend (recommended)**

- [ ] **RESEND_API_KEY** — **Secret.** Create at [resend.com](https://resend.com); use an API key with “Send emails” permission.
- [ ] **Resend domain:** In Resend dashboard, add and verify your sending domain (e.g. `clrhoa.com`). Set **NOTIFY_NOREPLY_EMAIL** to an address on that domain (e.g. `noreply@clrhoa.com`) so “From” is valid.

**Option B – MailChannels (if not using Resend)**

- [ ] **MAILCHANNELS_API_KEY** — **Secret.** Used only when **RESEND_API_KEY** is not set.

### 5.4 SMS (optional)

- [ ] **TWILIO_ACCOUNT_SID** — **Secret**
- [ ] **TWILIO_AUTH_TOKEN** — **Secret**
- [ ] **TWILIO_PHONE_NUMBER** — From number (e.g. `+15551234567`)

### 5.5 Backup download (Board → Backups)

Needed only if Board/Admin will use “Download backup (ZIP)” from the portal. Use a **narrowly scoped** API token.

- [ ] **CLOUDFLARE_ACCOUNT_ID** — Your Cloudflare account id (dashboard URL or API).
- [ ] **CLOUDFLARE_API_TOKEN** — **Secret.** Create in **My Profile → API Tokens**. Recommended permissions:
  - **D1:** Read (export database)
  - **R2:** Object Read (and Write if you ever add upload-from-portal)
  - **Account:** Read (for account context)
  - Do **not** grant Workers/KV/Pages edit unless needed. Restrict to specific resources (this D1, this R2 bucket) if the UI allows.
- [ ] **D1_DATABASE_ID** — Optional; only if your D1 binding uses a different database id than the one in wrangler (e.g. multi-environment).

### 5.6 Google Drive backup (optional)

Only if you use Board → Backups → Google Drive.

- [ ] **GOOGLE_CLIENT_ID** — **Secret**
- [ ] **GOOGLE_CLIENT_SECRET** — **Secret**
- [ ] **BACKUP_ENCRYPTION_KEY** — **Secret** (encrypts refresh token in D1)

### 5.7 Build-time (public) variables

Set for **Production** so the built site has correct URLs and content. These are embedded in the client (non-secret).

- [ ] **SITE** — Production URL (e.g. `https://clrhoa.com`)
- [ ] All **PUBLIC_*** variables you need for contact, addresses, meeting location, dues, analytics, etc. See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).

---

## 6. Rate limits (no extra config)

Rate limits are defined in code ([`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts)) and use the **KV** binding. Once **KV** is bound to the RATE_LIMIT namespace (steps 2 and 4), the following are enforced automatically:

- Login: 5 attempts per 15 minutes per IP  
- ARB uploads, directory phone/email reveals, feedback, CSV upload, etc.: per-endpoint limits  

No separate “rate limit config” env vars are required. Optional: review or tune values in `rate-limit.ts` before deploy.

---

## 7. First user (allow list) so someone can log in

Portal login only allows emails present in **CLOURHOA_USERS** KV. Add at least one admin **before** or immediately after deploy.

**Option A – Dashboard**

- [ ] Workers & Pages → Storage → KV → open the namespace bound as **CLOURHOA_USERS**
- [ ] Add entry: **Key** = admin email (lowercase), **Value** = `{"role":"admin"}`

**Option B – Wrangler (production)**

- [ ] `npx wrangler kv key put "admin@example.com" '{"role":"admin"}' --namespace-id=YOUR_CLOURHOA_USERS_NAMESPACE_ID`

After that, use **Board → Directory** to add owners and set “can log in” / roles; the app syncs them to KV.

---

## 8. Backup Worker (optional)

If you use **automated** backups (cron: D1 export + KV dump to R2, optional Google Drive), the backup Worker is a **separate** Cloudflare Worker with its own config and secrets.

- [ ] Deploy: `npm run backup:deploy` (from repo root; uses `workers/backup/wrangler.toml`)
- [ ] In **Workers & Pages → clrhoa-backup → Settings** (or the Worker name in that wrangler):
  - [ ] **CLOUDFLARE_ACCOUNT_ID** — Plain var (replace `REPLACE_WITH_ACCOUNT_ID` in wrangler or set in dashboard)
  - [ ] **CLOUDFLARE_BACKUP_API_TOKEN** — **Secret.** Scoped for: **D1 Read** (export), **R2 Edit** (write backup objects), **KV Read** (dump whitelist). This is separate from the deployment token for security.
  - [ ] **D1_DATABASE_ID** — Same as main app (already in workers/backup/wrangler.toml if you copied it)
  - [ ] **BACKUP_RETENTION_DAYS** — e.g. `30` (optional; default in wrangler)
- [ ] For **Google Drive** backup: set **GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET**, **BACKUP_ENCRYPTION_KEY** as secrets on the **backup Worker** (not only on Pages).

Cron is set in `workers/backup/wrangler.toml` (e.g. daily 2:00 AM UTC). No DNS or A/B changes required for the Worker.

---

## 9. DNS and A/B deployment (optional / future)

- **Current:** A single production deployment (e.g. `main` → Pages production). No DNS changes required for the first portal deploy.
- **Future A/B or blue-green:** You can later use Cloudflare DNS (e.g. CNAME to a staging Pages URL, or Workers with custom routes) to switch traffic between two deployments. Not required for “first portal in production.”

---

## 10. Deploy and verify

- [ ] Deploy: push to the branch that triggers production, or run `npm run build` then `wrangler pages deploy dist` (or your usual command).
- [ ] **Login:** Open **/portal/login** and sign in with the admin email you added to KV.
- [ ] **Board:** Add directory owners, vendors, news; confirm **Board → Backups** shows “Last backup” (or “Never” if backup Worker not yet run).
- [ ] **Notifications:** Trigger a test (e.g. contact form or ARB submission if applicable) and confirm NOTIFY_* emails arrive and “From” is correct (Resend domain).
- [ ] **Rate limits:** Optional: try repeated login failures or directory reveals to confirm lockout/limits apply.

---

## Quick reference: what goes where

| Item | Where |
|------|--------|
| D1, KV (3), R2 | Create in Cloudflare; put IDs in wrangler.toml; bind in **Pages** project |
| SESSION_SECRET, RESEND_API_KEY, etc. | **Pages** → Settings → Environment variables (Encrypt for secrets) |
| First admin user | **KV** namespace CLOURHOA_USERS (Dashboard or wrangler kv key put) |
| Backup cron + R2/D1 export | **Backup Worker** (separate project); CLOUDFLARE_API_TOKEN scoped D1 Read + R2 Edit (+ KV Read) |
| Backup “Download ZIP” from portal | **Pages** env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (same scoping idea) |

---

## Summary order

1. Create D1, KV x3, R2 → update wrangler.toml with IDs.  
2. Run `npm run db:remote:all`.  
3. In Pages: bind DB, CLOURHOA_USERS, SESSION, KV, CLOURHOA_FILES.  
4. In Pages: set SESSION_SECRET (required); NOTIFY_* and Resend (or MailChannels); backup vars if needed; PUBLIC_* and SITE.  
5. Add first admin to CLOURHOA_USERS KV.  
6. (Optional) Deploy backup Worker and set its secrets.  
7. Deploy Pages → test login, Board, and notifications.

You’re ready for production once every item you need in sections 1–7 is checked and 10 is verified.
