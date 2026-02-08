# Deploying the portal and DB-backed updates to production

This guide helps you deploy the current site (including the member portal and DB-backed public pages) without breaking existing functionality and ensures someone can always log in to manage the directory and allow list.

**→ For a step-by-step checklist (resources, env vars, Resend, rate limits, Cloudflare tokens, backup, first user), use [DEPLOYMENT_CHECKLIST_PORTAL.md](./DEPLOYMENT_CHECKLIST_PORTAL.md).**

---

## 1. What would break (and what won’t)

### Public pages: /news and /resources/vendors

- **/news**  
  - **Static:** Markdown articles from `src/content/news/` still render.  
  - **From DB:** Board news items, meetings “on public news,” and vendor count come from D1.  
  - **If D1 is empty:** You still see markdown news. Board news and meetings sections are empty; vendor count is 0. **Nothing crashes.**

- **/resources/vendors**  
  - **Fully from DB:** `listPublicVendors(db)`.  
  - **If D1 is empty:** The page shows the empty state (e.g. “No vendors listed yet”). **Nothing crashes.**

So deploying with an empty or new D1 does **not** break these pages; DB-backed sections are just empty until you add data.

### “Losing” existing content

- **If production today has no D1 (fully static):**  
  - There is no existing DB data to lose.  
  - Static content (markdown news, etc.) stays in the repo and keeps working.  
  - Any vendors that were hardcoded in the old site are **not** in D1. After deploy you can:  
    - Re-add them via **Board → Vendors** after first login, or  
    - Run a one-time seed script that inserts into `vendors` and sets `show_on_public = 1` if you have a list.

- **If production already has D1 and you’re just updating the app:**  
  - Run any **new** migrations (see below).  
  - Don’t drop or overwrite tables that hold existing data.  
  - Then deploy. Existing DB data is preserved.

### Portal and login

- **Login is allowed only for emails in the KV allow list** (`CLOURHOA_USERS`).  
- If **no** keys are in that KV namespace, **no one** can log in.  
- So you must **add at least one email (e.g. admin) to KV** before or right after deploy so that person can log in and then add the directory and other users.

---

## 2. Pre-deploy checklist (do before or right after first deploy)

Do these in order so the app has DB, secrets, and at least one allowed user.

### 2.1 Cloudflare resources (D1, KV, R2)

If you haven’t already:

```bash
npx wrangler login
npx wrangler d1 create clrhoa_db
npx wrangler kv namespace create clrhoa_users
npx wrangler kv namespace create SESSION
npx wrangler kv namespace create RATE_LIMIT
npx wrangler r2 bucket create clrhoa-files
```

Put the printed **IDs** into `wrangler.toml`:

- D1: `database_id` under `[[d1_databases]]`
- KV: `id` for `CLOURHOA_USERS`, `SESSION`, and replace `REPLACE_WITH_RATE_LIMIT_KV_ID` with the RATE_LIMIT namespace id for `KV`
- R2: bucket name `clrhoa-files` is already set; no id needed

### 2.2 Run all D1 migrations (production)

From the project root:

```bash
npm run db:remote:all
```

That runs every migration in `scripts/run-all-db-remote.js` (including news-items, vendors-show-on-public, meetings-post-to-public, vendor-audit, etc.) against the **remote** (production) D1. If a step fails with “table already exists” or “column already exists,” that migration is already applied; the script skips it and continues.

### 2.3 Secrets and env vars (one place: Pages)

**You only manage the site in one place:** the Cloudflare **Pages** project. There is no separate “Workers” project for the site—Pages runs the app and its bindings. Set everything under **Workers & Pages → your project → Settings → Environment variables** (and **Bindings**).

**Required for login:**

- **SESSION_SECRET** — set as an **Encrypted** (secret) variable in the Pages project. Long random string (32+ characters).

If you deploy via **wrangler pages deploy** and your project is linked to the same account, you can also run `npx wrangler secret put SESSION_SECRET` for that project; for **Git-connected** Pages builds, use the dashboard and set **SESSION_SECRET** in **Environment variables** (Production) and mark it **Encrypt**.

**Full list:** See **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** for every secret and env var the site uses (required vs optional, bindings vs env, and the optional backup Worker as the only “second place”).

### 2.4 Bindings in Cloudflare Pages

In **Cloudflare Dashboard → Workers & Pages → your project → Settings**:

- **D1:** Bind database `clrhoa_db` as `DB`.
- **KV:** Bind the three namespaces as `CLOURHOA_USERS`, `SESSION`, and `KV` (same names as in `wrangler.toml`).
- **R2:** Bind bucket `clrhoa-files` as `CLOURHOA_FILES`.

(If you deploy with `wrangler pages deploy` and use `wrangler.toml`, bindings may come from there; ensure they match.)

### 2.5 First user (allow list) so someone can log in

Portal login only allows emails that exist in the **CLOURHOA_USERS** KV namespace. Add at least one admin **before** you need to log in.

**Option A – Cloudflare Dashboard**

1. Go to **Workers & Pages → Storage → KV**.
2. Open the namespace that is bound as **CLOURHOA_USERS** (use the id from `wrangler.toml`).
3. **Add entry:**
   - **Key:** the email (e.g. `your-admin@example.com`). Use lowercase.
   - **Value:** `{"role":"admin"}` for an admin, or `1` for a plain member.

**Option B – Wrangler (production namespace)**

Use the **production** KV namespace id for `CLOURHOA_USERS` (the one in `wrangler.toml`):

```bash
# One admin (replace with your email)
npx wrangler kv key put "your-admin@example.com" '{"role":"admin"}' --namespace-id=YOUR_CLOURHOA_USERS_NAMESPACE_ID
```

After deploy, that user can log in at **/portal/login** and then use **Board → Directory** to add owners and set roles. Adding an owner with a role (or “can log in”) updates the allow list (KV) so those users can log in too. So the **allow list** is maintained by:

- **KV (CLOURHOA_USERS):** Who can log in at all.  
- **Board → Directory:** Adding/editing owners and their roles updates KV. Removing someone from the directory removes them from KV **unless** their role is **admin** (admins stay in KV even if removed from the directory).

---

## 3. Deploy

- Push to the branch that triggers production (e.g. `main`), or run your usual deploy command (e.g. `npm run build` then `wrangler pages deploy dist`).
- After deploy, open **/portal/login** and sign in with the email you put in KV. Then:
  - Use **Board → Directory** to add owners and set “can log in” / roles.
  - Use **Board → Vendors** to add vendors; check “Show on public” so they appear on **/resources/vendors**.
  - Use **Board → News** to add board news so they appear on **/news**.

---

## 4. Keeping public pages from “going empty”

- **Vendors:** All public vendors come from the `vendors` table with `show_on_public = 1`. Add them via **Board → Vendors** (or a one-time seed). Nothing is lost on deploy if you don’t delete or reset D1.
- **News:**  
  - Markdown news is in the repo; it doesn’t depend on D1.  
  - Board news and meetings on **/news** come from D1; add them via Board after first login.  
- **Meetings on /news:** Create meetings in **Board → Meetings** and check “Post to public news.”

If you had a **static** vendor list on the old site (hardcoded HTML), that content is not in D1. Export or copy that list and re-add it via Board → Vendors (or a seed script) after first login so **/resources/vendors** is populated again.

---

## 5. Summary

| Concern | What to do |
|--------|------------|
| Public /news and /resources/vendors “breaking” | They don’t break; they use DB and show empty if D1 is empty. Static markdown news still works. |
| Not losing public data | Don’t drop or reset D1. Run only migrations. If old site was static, re-add vendors via Board or a seed. |
| Someone can log in to add/update directory | Add at least one email to KV (CLOURHOA_USERS) as admin before or right after deploy; then log in and use Board → Directory. |
| Allow list (who can register / have portal access) | The allow list **is** KV (CLOURHOA_USERS). Board → Directory adds/removes members and updates KV; admins stay in KV even if removed from directory. |

**Order of operations:** Create D1/KV/R2 → run remote migrations → set SESSION_SECRET → add first admin to KV → configure Pages bindings and secrets → deploy → log in as that admin → add directory and vendors.

For full migration order and any extra steps, see **DB_MIGRATIONS.md**. For local dev and KV, see **PORTAL_SETUP.md**.
