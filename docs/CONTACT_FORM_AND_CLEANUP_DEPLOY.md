# Contact Form & Cleanup – Deploy Checklist

What you need in **.secrets.local**, **.vars.local**, and (for local dev) **.dev.vars** to deploy and run the contact form with captcha and the contact-cleanup worker.

---

## 1. Main site (contact form with reCAPTCHA)

### .vars.local (build-time / GitHub Variables)

You already have:

- **PUBLIC_RECAPTCHA_SITE_KEY** – reCAPTCHA v2 **site key** (public)
- **SITE** – e.g. `https://clrhoa.com` (used for captcha hostname verification)

Nothing else is required in `.vars.local` for the contact form.

### .secrets.local (runtime / GitHub Secrets)

Add the reCAPTCHA **secret** key so the API can verify captcha tokens:

```bash
# Get this from the same reCAPTCHA admin as the site key (https://www.google.com/recaptcha/admin)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
```

- If this is **missing**, the contact form still works but captcha is **not** verified (any token or none is accepted).
- Once set and synced to Cloudflare, the API will require a valid captcha and check hostname.

**Sync to GitHub:**  
After editing `.secrets.local`, push secrets to GitHub so the deploy workflow can sync them to Cloudflare:

```bash
npm run secrets:update
```

(Or add `RECAPTCHA_SECRET_KEY` manually in GitHub → Settings → Secrets and variables → Actions → Secrets.)

---

## 2. Local development (contact form with captcha)

Runtime secrets for **local** runs (`npm run dev` / `wrangler pages dev`) come from **.dev.vars**, not from `.secrets.local`.

Create or edit **.dev.vars** in the project root (same folder as `package.json`):

```bash
# .dev.vars (gitignored – do not commit)
SESSION_SECRET=your-local-session-secret
# … other secrets you need locally (NOTIFY_BOARD_EMAIL, RESEND_API_KEY, etc.)

# Required for contact form captcha verification in local dev
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
```

Then run:

```bash
npm run dev
```

So:

- **.vars.local** + **.secrets.local** → merged into **.env.local** (build-time PUBLIC_* and any merge script use).
- **.dev.vars** → used by Wrangler at **runtime** for local dev so the contact API sees `RECAPTCHA_SECRET_KEY`.

---

## 3. Contact-cleanup worker (optional)

The worker that deletes expired contact submissions is **separate** from the main site. It does **not** use `.vars.local` or `.secrets.local`.

- **Deploy:**  
  `npm run contact-cleanup:deploy`  
  (uses `workers/contact-cleanup/wrangler.toml`; D1 binding is already configured there.)

- **Optional – manual trigger:**  
  If you want to call the worker’s `/trigger` endpoint with a secret:

  ```bash
  npx wrangler secret put CLEANUP_TRIGGER_SECRET --config workers/contact-cleanup/wrangler.toml
  ```

  You do **not** add this to `.secrets.local`; it’s specific to the worker.

---

## 4. Summary

| What | .vars.local | .secrets.local | .dev.vars (local only) |
|------|-------------|----------------|-------------------------|
| Contact form (captcha) | PUBLIC_RECAPTCHA_SITE_KEY, SITE ✓ | **RECAPTCHA_SECRET_KEY** (add this) | **RECAPTCHA_SECRET_KEY** (for local dev) |
| Contact-cleanup worker | — | — | — |

**Minimum for production contact form + captcha:**

1. Add **RECAPTCHA_SECRET_KEY** to **.secrets.local**.
2. Run **npm run secrets:update** (or add the secret in GitHub Actions).
3. Redeploy so the workflow syncs secrets to Cloudflare.

**For local dev with captcha:**

- Add **RECAPTCHA_SECRET_KEY** to **.dev.vars**.
