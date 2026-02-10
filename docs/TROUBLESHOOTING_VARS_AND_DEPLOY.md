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

## 4. Checklist to get back to a working state

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

## 5. Optional: use local files to repopulate GitHub Variables

If you have a working `.vars.local` (or `.env.local` with `PUBLIC_*` and `SITE`):

```bash
# Export variable names and values to a template
npm run vars:export

# Edit .vars.local or the generated file, then push vars to GitHub (requires gh CLI)
npm run vars:update
```

See **vars:update** in the repo scripts and [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for how `vars:update` writes to GitHub **Variables**.

---

## 6. Summary

| Symptom | Cause | Fix |
|--------|--------|-----|
| Dues / address / waste / meeting data missing or wrong on live site | Build didn’t get vars | Add as **GitHub Variables** (not Secrets), re-run deploy |
| “Verify public env vars” shows **missing** for key names | Those names aren’t set as Variables (or are only in Secrets) | Add them in **Variables** (or production env vars), re-run |
| Cloudflare dashboard only shows some vars | Expected; PUBLIC_* are build-time only | No change needed; fix is in GitHub Variables + new build |

The live site is built **in GitHub Actions**. Whatever **Variables** the workflow has when it runs `npm run build` are what get baked into the site. Cloudflare only receives the built `dist` and runtime secrets; it does not re-run the build or inject `PUBLIC_*` from the Cloudflare UI.
