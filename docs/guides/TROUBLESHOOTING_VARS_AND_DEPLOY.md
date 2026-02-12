# Troubleshooting: Missing Dues, Address, Waste Management, etc. on Live Site

If the **live site** (Cloudflare Pages) shows placeholders, wrong amounts, or missing content (dues, address, waste/recycling, meeting location) while everything works locally, the build in GitHub Actions did not receive the right **Variables**.

---

## 1. Variables vs Secrets (most common cause)

**The deploy workflow only gets `PUBLIC_*` and `SITE` from GitHub Variables, not from Secrets.**

| In GitHub you have | Used by workflow as | Result for build |
|--------------------|---------------------|------------------|
| **Variables** (Settings → Actions → **Variables** tab, or Environments → production → **Environment variables**) | `vars.PUBLIC_QUARTERLY_DUES_AMOUNT` etc. | ✅ Available at build → baked into site |
| **Secrets** (Settings → Actions → **Secrets** tab) | `secrets.SESSION_SECRET` etc. | ❌ **Not** passed to build env; only for sync step |

If you added dues amount, address, waste management, etc. as **Secrets**, the workflow never passes them to `npm run build`, so the built site has empty/placeholder values.

**Fix:**

1. Go to **Settings → Secrets and variables → Actions**.
2. Open the **Variables** tab (not Secrets).
3. Add (or move) every `PUBLIC_*` and `SITE` / `SITE_LAST_MODIFIED` as **Variables**.
4. If you use **Environments**: **Settings → Environments → production** → **Environment variables** and add them there (same names, as Variables not Secrets).

Use **Secrets** only for: `SESSION_SECRET`, `CLOUDFLARE_DEPLOY_API_TOKEN`, `RESEND_API_KEY`, etc. (see GITHUB_SECRETS_SETUP.md).

---

## 2. Verify what the build actually saw

After the next deploy:

1. Go to **Actions** → open the latest **Deploy to Cloudflare** run.
2. Open the **Verify public env vars** step and check the log.

You’ll see lines like:

- `PUBLIC_QUARTERLY_DUES_AMOUNT: set (3 chars)` → value was present at build.
- `PUBLIC_QUARTERLY_DUES_AMOUNT: missing` → value was **not** available; add it as a **Variable** (see above) and re-run the workflow.

If key vars show **missing**, add them in the **Variables** tab (or in **production** environment variables), then **re-run** the workflow (push a commit or “Run workflow” on the Deploy workflow).

---

## 3. Why Cloudflare dashboard shows “only some” vars

Cloudflare Pages → your project → **Settings → Environment variables** shows **runtime** vars (and secrets) for the Worker that serves the app. The deploy workflow does **not** upload `PUBLIC_*` to Cloudflare; those are only used **during build** in GitHub and are baked into the HTML/JS.

So:

- **Cloudflare** will show: secrets and vars that the sync script pushes (e.g. `SESSION_SECRET`, email keys). That’s expected.
- **Dues, address, waste management** come from **build-time** vars in GitHub. They never need to be set in Cloudflare for the site content; they must be set as **GitHub Variables** and present when the workflow runs `npm run build`.

---

## 4. Cloudflare Pages might be building from Git (very common)

**If your GitHub Variables are set and “Verify public env vars” shows them as set, but the live site still shows wrong or empty dues/address/etc., Cloudflare is likely building the site itself and overwriting the deployment from GitHub Actions.**

When Cloudflare Pages is connected to your Git repo and has **Build** enabled, every push triggers a **Cloudflare** build. That build runs on Cloudflare’s servers and does **not** have access to your GitHub Variables. When that build finishes, it deploys and can **overwrite** the deployment that GitHub Actions just uploaded (the one built with your Variables). So the live site ends up being the Cloudflare build (no vars), not the GitHub build (with vars).

**Fix:**

1. In **Cloudflare Dashboard** go to **Workers & Pages** → **clrhoa-site** → **Settings** (or **Builds & deployments**).
2. If you see **Build configuration** with a **Build command** and a **Branch** (e.g. `main`) connected:
   - Either **disable** the Cloudflare build (e.g. “Do not build” or disconnect the branch), so that **only** the GitHub Actions deployment (upload of `dist`) is used, **or**
   - Stop using GitHub Actions to deploy and instead add all `PUBLIC_*` and `SITE` as **Cloudflare Pages → Environment variables** so Cloudflare’s build has them (more work and you hit the sync 500 issue).
3. Recommended: **Use only GitHub Actions to build and deploy.** In Cloudflare Pages settings, set the project to accept **Direct Uploads** only (no Git-based build). The `cloudflare/pages-action` in your workflow uploads the pre-built `dist` folder; that deployment should be the one that’s live.

After disabling Cloudflare’s build, trigger a new deploy from GitHub Actions (push a commit or “Run workflow”). The live site should then show the values from your GitHub Variables.

---

## 5. Checklist to get back to a working state

1. **List what you need**
   See **Minimum for Dues page and Local Resources** in [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md#why-the-live-site-shows-wrong-address-dues-amount-or-missing-recycling-data).

2. **Put them in GitHub Variables (not Secrets)**
   - **Settings → Secrets and variables → Actions → Variables**
   - Or **Settings → Environments → production → Environment variables**
   Add: `SITE`, `PUBLIC_QUARTERLY_DUES_AMOUNT`, `PUBLIC_MAILING_ADDRESS_*`, `PUBLIC_PAYMENT_*`, `PUBLIC_*_LATE_FEE_*`, all `PUBLIC_*` for waste/recycling/meeting/dues as in the table in ENVIRONMENT_VARIABLES.md.

3. **Trigger a new build**
   Push a commit to `main` or run **Actions → Deploy to Cloudflare → Run workflow**.

4. **Confirm in the run**
   In that run, open **Verify public env vars** and ensure the important vars show **set**, not **missing**.

5. **Check the live site**
   Reload the Dues page and Local Resources; they should show the values you set.

---

## 6. “Environment variables are being managed through wrangler.toml”

If Cloudflare Pages shows: **“Environment variables for this project are being managed through wrangler.toml. Only Secrets (encrypted variables) can be managed via the Dashboard.”**

That’s expected when the project uses a `wrangler.toml` (or is linked to one). In that mode:

- **Secrets** (encrypted) **can** be added in the Dashboard: e.g. `SESSION_SECRET`, `D1_DATABASE_ID`, `RESEND_API_KEY`, `NOTIFY_BOARD_EMAIL`, `RECAPTCHA_SECRET_KEY`, etc. Add those under **Pages → clrhoa-site → Settings → Environment variables** as **Encrypt** (Secrets).
- **Plain-text variables** (e.g. `PUBLIC_QUARTERLY_DUES_AMOUNT`) **cannot** be added or edited in the Dashboard; Cloudflare expects them from `wrangler.toml` when that config is in use.

For this project that’s fine:

- **PUBLIC_*** and **SITE** are only needed at **build time**. The build runs in **GitHub Actions** and reads **GitHub Variables**, so those values are baked into the deployed site. They do **not** need to exist in Cloudflare for the live site to show the right dues/address/etc., as long as the deploy is the one from GitHub (see §4).
- **Runtime secrets** are what the app needs in Cloudflare. Add those as **Secrets** in the Dashboard; the “only Secrets” restriction does not block that.

So: add **Secrets** in the Dashboard; keep **PUBLIC_*** and **SITE** in **GitHub Variables** only. No need to put `PUBLIC_*` in wrangler.toml unless you later switch to building on Cloudflare.

---

## 7. Optional: use local files to repopulate GitHub Variables

If you have a working `.vars.local` (or `.env.local` with `PUBLIC_*` and `SITE`):

```bash
# Export variable names and values to a template
npm run vars:export

# Edit .vars.local or the generated file, then push vars to GitHub (requires gh CLI)
npm run vars:update
```

See **vars:update** in the repo scripts and [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for how `vars:update` writes to GitHub **Variables**.

---

## 8. "Sync Secrets to Cloudflare Pages" fails with API 500

If the workflow step **Sync Secrets to Cloudflare Pages** fails with:

```text
❌ Failed to sync env: API error 500: { "errors": [{ "code": 8000000, "message": "An unknown error occurred..." }] }
```

Cloudflare’s API sometimes returns 500 for large or burst requests. The sync script now:

- **Retries** up to 3 times with backoff (0s, 2s, 4s) on 500.
- **Batches** env vars (20 per request) when syncing many vars.
- **Syncs only runtime secrets by default** — `PUBLIC_*` and `SITE` are **not** sent to Cloudflare (they are build-time only in GitHub). This keeps the payload small and usually avoids 500s.

**What you can do:**

1. **Re-run the workflow** — With secrets-only sync, the payload is small; the step should succeed.
2. **Check token** — Use a token with **Cloudflare Pages → Edit** (and Account → Read). See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md).
3. **If you need PUBLIC_* in Cloudflare** — Set `SYNC_PAGES_VARS=1` in the workflow env for that step (optional; may increase chance of 500 again).
4. **If it still fails** — Set secrets once in **Cloudflare Dashboard → Pages → your project → Settings → Environment variables** and optionally skip the sync step.

---

## 9. Summary

| Symptom | Cause | Fix |
|--------|--------|-----|
| Dues / address / waste / meeting data missing or wrong on live site | Build didn’t get vars | Add as **GitHub Variables** (not Secrets), re-run deploy |
| “Verify public env vars” shows **missing** for key names | Those names aren’t set as Variables (or are only in Secrets) | Add them in **Variables** (or production env vars), re-run |
| Cloudflare dashboard only shows some vars | Expected; PUBLIC_* are build-time only | No change needed; fix is in GitHub Variables + new build |
| Sync step fails with API 500 | Cloudflare API transient or payload size | Re-run workflow; script retries and batches; or set vars manually in Cloudflare |
| Vars show “set” in Verify but live site still wrong | Cloudflare Pages is building from Git and overwriting GitHub’s deploy | Disable Cloudflare’s build; use only GitHub Actions to build and deploy (Direct Upload) |

The live site is built **in GitHub Actions**. Whatever **Variables** the workflow has when it runs `npm run build` are what get baked into the site. Cloudflare only receives the built `dist` and runtime secrets; it does not re-run the build or inject `PUBLIC_*` from the Cloudflare UI.
