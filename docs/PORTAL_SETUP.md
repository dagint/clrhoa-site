# CLR HOA Portal (Phase 1) Setup

Portal runs at **clrhoa.com/portal** alongside the existing public site. It uses Cloudflare D1 (users), KV (email whitelist), and R2 (member-only files).

---

## Constraint: stay on free tier

**All portal phases should stay within free solutions.** When adding features (email, notifications, new storage, etc.):

- Prefer **Cloudflare free tier** (Pages, Workers, D1, KV, R2) and stay under published limits.
- Prefer **client-side** processing (e.g. image resize in the browser) over paid server-side APIs.
- For email, use a provider with a **free tier** (e.g. Resend, SendGrid free tier) if needed.
- Avoid paid third-party auth, paid image CDNs, or paid APIs unless there is no free alternative.

See [Cloudflare free tier limits](https://developers.cloudflare.com/workers/platform/limits/) and R2/D1/KV pricing pages to stay within free usage.

---

## Where do I run this?

| Task | Where | What you do |
|------|--------|-------------|
| **Create D1, KV, R2** | **Your computer** — terminal (PowerShell, Cursor, or VS Code) in the project folder (`clrhoa-site`) | Run the `npx wrangler ...` commands below. Wrangler talks to Cloudflare and creates the resources in your Cloudflare account. |
| **Edit `wrangler.toml`** | **Your computer** — in Cursor/VS Code | Paste the IDs that the wrangler commands printed into `wrangler.toml` (replace `YOUR_D1_DATABASE_ID`, etc.). |
| **Set SESSION_SECRET** | **Your computer** — terminal | Run `npx wrangler secret put SESSION_SECRET` (for production). For local dev, create a `.dev.vars` file in the project root. |
| **D1 schema (create table)** | **Your computer** — terminal | Run `npm run db:init:local` or `npm run db:init`. Or optionally run the SQL yourself in the **Cloudflare dashboard** (D1 → your database → Console). |
| **Add emails to whitelist** | **Your computer** — terminal, or **Cloudflare dashboard** | Terminal: `npx wrangler kv:key put ...`. Or in dashboard: Workers & Pages → KV → clrhoa_users → Add entry. |
| **Upload portal files (R2)** | **Cloudflare dashboard** (easiest) or your computer | Dashboard: R2 → clrhoa-files → Upload. Or use wrangler to upload from your machine. |
| **Deploy the site** | **Cloudflare dashboard** or **your computer** | Connect repo in Pages (dashboard) with build command `npm run build` and output `dist`, or deploy with `npx wrangler pages deploy dist` from your computer. |

**Short answer:** Almost everything is run **from your own machine** in a terminal opened in the `clrhoa-site` project folder. The only things you might do in the **Cloudflare dashboard** (in the browser at dash.cloudflare.com) are: optionally run D1 SQL by hand, add KV keys by hand, upload R2 files, and configure/connect the Pages project.

---

## 1. Cloudflare resources (run on your computer)

Open a terminal in the project folder (`c:\Users\dagin\Documents\code\clrhoa-site`). If you haven’t already, log in to Cloudflare once: `npx wrangler login` (opens browser).

```bash
# D1 database
npx wrangler d1 create clrhoa_db
# → copy database_id into wrangler.toml [[d1_databases]].database_id

# KV namespaces (email whitelist + adapter session placeholder)
npx wrangler kv namespace create clrhoa_users
npx wrangler kv namespace create SESSION
# → copy ids into wrangler.toml (CLOURHOA_USERS and SESSION)

# R2 bucket (portal documents)
# If you get "Please enable R2 through the Cloudflare Dashboard", enable R2 first:
#   1. Go to https://dash.cloudflare.com → select your account
#   2. In the left sidebar: R2 Object Storage (under "Storage" or "Workers & Pages")
#   3. Click "Enable R2" / "Get started" and accept any terms
#   4. Then run:
npx wrangler r2 bucket create clrhoa-files
# → bucket_name is clrhoa-files (binding in wrangler.toml is already set)
```

Then **in your editor**, open `wrangler.toml` and replace `YOUR_D1_DATABASE_ID`, `YOUR_KV_NAMESPACE_ID`, and `YOUR_SESSION_KV_NAMESPACE_ID` with the values the commands printed.

## 2. D1 schema (run on your computer, or run SQL in dashboard)

From the project folder:

```bash
npm run db:init:local   # for local dev
npm run db:init         # for production (run after first deploy)
```

Alternatively, in the **Cloudflare dashboard**: Workers & Pages → D1 → your database → Console → paste and run the SQL from `scripts/schema.sql`.

## 3. Secrets

**Production** (run on your computer; wrangler will prompt for the secret):

```bash
npx wrangler secret put SESSION_SECRET
# Enter a long random string (e.g. 32+ chars).
```

**Local dev only:** in your editor, create a file named `.dev.vars` in the project root (same folder as `package.json`) with:

```
SESSION_SECRET=your-dev-secret-at-least-32-chars
```

Do not commit `.dev.vars`.

## 4. Email whitelist (KV)

To allow an email to log in, add a key to the `clrhoa_users` KV namespace.

**Local dev uses a separate (local) KV.** When you run `npm run dev` or `npm run preview`, the app reads from **local** KV, not the remote one. So emails you added with `--remote` are not visible locally. Add at least one test user to **local** KV so you can log in during development:

```bash
# Add one user for local login (use your own email; run from project root)
npx wrangler kv key put "your-email@example.com" "1" --binding=CLOURHOA_USERS --local
# Or with a role:
npx wrangler kv key put "your-email@example.com" "{\"role\":\"admin\"}" --binding=CLOURHOA_USERS --local
```

**Production (remote) KV** — from your computer:

```bash
npx wrangler kv key put "member@example.com" "1" --binding=CLOURHOA_USERS --remote
npx wrangler kv key put "board@example.com" "{\"role\":\"admin\"}" --binding=CLOURHOA_USERS --remote
```

**Option B — in Cloudflare dashboard:** Workers & Pages → KV → select `clrhoa_users` → Add entry (key = email, value = `1` or `{"role":"admin"}`). Dashboard edits apply to **remote** only; local dev still needs the `--local` commands above.

## 5. R2 portal files

Upload redacted minutes, budgets, etc. so they appear under **Portal → Documents**.

- **Easiest:** In **Cloudflare dashboard**: R2 → `clrhoa-files` → Upload.
- Or from your computer with wrangler (see Cloudflare R2 docs).

## 6. Build and preview (all on your computer)

From the project folder:

```bash
npm install
npm run build
npm run preview   # runs wrangler pages dev ./dist — test at http://localhost:8788
```

**Deploying to clrhoa.com:** In the **Cloudflare dashboard**, connect your repo to Pages (or use “Upload project” and upload the `dist` folder). Set build command to `npm run build`, output directory to `dist`. In the Pages project, attach the same D1 database, KV namespaces, and R2 bucket (or rely on wrangler.toml if you deploy via `npx wrangler pages deploy dist` from your computer).

## Routes

| Route | Description |
|-------|-------------|
| `/portal/login` | Email sign-in (whitelist) |
| `/portal/dashboard` | Protected welcome, shows role |
| `/portal/documents` | Protected list + download from R2 |
| `/api/login` | POST form → set session cookie, redirect |
| `/api/logout` | Clear cookie, redirect to login |
| `/api/portal/file/[...key]` | GET stream R2 object (auth required) |

## Security

- Session: signed HttpOnly cookie (`clrhoa_session`), 7-day expiry, Secure in production.
- Middleware: every `/portal/*` (except login) requires the session cookie or redirects to login.
- Protected pages and `/api/portal/*` validate the session server-side.

## Preserved (unchanged)

- `public/docs/*` (PDF/DOCX) and `src/pages/documents.astro` are unchanged; public documents remain as-is.
