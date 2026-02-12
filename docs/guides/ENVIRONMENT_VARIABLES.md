# Environment Variables Guide

This site uses environment variables to store sensitive information and configuration that shouldn't be committed to the repository.

---

## Variables vs Secrets (important for deploy)

| Store in GitHub as | Used for | Where to set |
|--------------------|----------|--------------|
| **Variables** | `PUBLIC_*`, `SITE`, `SITE_LAST_MODIFIED` — **build-time** (dues, address, waste, meeting, etc.) | Settings → Secrets and variables → **Actions → Variables** tab, or **Environments → production → Environment variables** |
| **Secrets** | `SESSION_SECRET`, API keys, tokens — **runtime** (login, email, Cloudflare sync) | Settings → Secrets and variables → **Actions → Secrets** tab |

**If the live site is missing dues, address, waste management, or other content:** those values must be **Variables**, not Secrets. The deploy workflow only passes `vars.*` into the build; it does not pass `secrets.*` into the build step. See [TROUBLESHOOTING_VARS_AND_DEPLOY.md](./TROUBLESHOOTING_VARS_AND_DEPLOY.md) for step-by-step fixes.

---

## Why the live site shows wrong address, dues amount, or missing recycling data

**The site is built in GitHub Actions**, not on Cloudflare. The workflow runs `npm run build` and passes **GitHub Variables** into that step. Those values are baked into the static pages at build time. Cloudflare only receives the built `dist` folder.

- **If the Dues page shows wrong address, wrong amount, or placeholder text** → the Build step did not have those values. Set them as **GitHub Variables** (not Secrets).
- **If Local Resources is missing waste management / recycling links and data** → same: add the recycling and waste vars as **GitHub Variables**.

**Where to set them:** Repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** tab → add (or edit) each variable.
If you use **Environments** (e.g. production): Repo → **Settings** → **Environments** → **production** → **Environment variables**. The deploy workflow uses `environment: production` so it can read both repository Variables and production environment variables.

**Minimum for Dues page and Local Resources:**

| Variable | Used for |
|----------|----------|
| `PUBLIC_QUARTERLY_DUES_AMOUNT` | Dues page amount (e.g. `150`) |
| `PUBLIC_MAILING_ADDRESS_NAME` | Dues & contact (e.g. Crooked Lake Reserve HOA) |
| `PUBLIC_MAILING_ADDRESS_LINE1` | Dues & contact (e.g. P.O. Box 1234) |
| `PUBLIC_MAILING_ADDRESS_LINE2` | Dues & contact (e.g. City, ST 12345) |
| `PUBLIC_PAYMENT_METHODS` | Dues page (e.g. Check or money order) |
| `PUBLIC_LATE_FEE_AMOUNT` | Dues page (e.g. `25`) |
| `PUBLIC_LATE_FEE_DAYS` | Dues page (e.g. `15`) |
| `PUBLIC_PAYMENT_INSTRUCTIONS` | Dues page instructions |
| `PUBLIC_PAYMENT_DROP_OFF_LOCATION` | Dues page drop-off (you said this one works) |
| `PUBLIC_TRASH_SCHEDULE` | Local Resources |
| `PUBLIC_RECYCLING_SCHEDULE` | Local Resources |
| `PUBLIC_RECYCLING_CENTER_NAME` | Local Resources |
| `PUBLIC_RECYCLING_CENTER_ADDRESS` | Local Resources |
| `PUBLIC_RECYCLING_CENTER_HOURS` | Local Resources |
| `PUBLIC_RECYCLING_CENTER_PHONE` | Local Resources |
| `PUBLIC_RECYCLING_CENTER_WEBSITE` | Local Resources |
| `PUBLIC_WASTE_MANAGEMENT_CONTACT` | Local Resources |
| `PUBLIC_WASTE_MANAGEMENT_PHONE` | Local Resources |
| `PUBLIC_WASTE_MANAGEMENT_WEBSITE` | Local Resources |

After adding or changing Variables, **re-run the deploy** (push a small commit to `main` or use Actions → "Deploy to Cloudflare" → Run workflow) so a new build runs with the updated values.

---

## Production deployment: one place (Cloudflare Pages)

**You do not manage the site in two places.** The live site is a **single Cloudflare Pages project**. All env vars, secrets, and bindings for the site are configured in that project only:

- **Workers & Pages → your project (e.g. clrhoa-site) → Settings**
  - **Environment variables** — plain variables and **Encrypt** (secrets)
  - **Bindings** — D1 database, KV namespaces, R2 bucket (same names as in `wrangler.toml`: `DB`, `CLOURHOA_USERS`, `SESSION`, `KV`, `CLOURHOA_FILES`)

A **separate** place exists only if you use the **backup Worker** (Board → Backups, `npm run backup:deploy`). That Worker has its own project and its own secrets; the table below lists only what the **site** (Pages) needs.

---

## Site deployment: secrets and env vars (Pages)

Configure these under **Workers & Pages → [your project] → Settings → Environment variables** (and **Bindings** for D1/KV/R2). Use **Encrypt** for any secret.

### Required for portal login

| Name | Type | Where / notes |
|------|------|----------------|
| `SESSION_SECRET` | **Secret** | **Required** for login. Long random string (32+ chars). Set as **Encrypted** in Pages. |

Without `SESSION_SECRET`, session cookies cannot be signed and portal login will not work.

### Required bindings (not env vars)

These are **resource bindings** in Pages (Settings → Bindings), not key/value env vars. Create the resources in the Cloudflare dashboard (or via wrangler), then attach them to the Pages project with these binding names:

| Binding name | Type | Purpose |
|--------------|------|---------|
| `DB` | D1 | Database (portal, directory, vendors, news, etc.) |
| `CLOURHOA_USERS` | KV | Login allow list (who can log in) |
| `SESSION` | KV | Session storage |
| `KV` | KV | Rate limiting / login lockout (replace `REPLACE_WITH_RATE_LIMIT_KV_ID` in wrangler.toml with real namespace id) |
| `CLOURHOA_FILES` | R2 | Portal files (e.g. member documents) |

### Optional runtime vars (Pages env)

**Email:** The app supports **Resend** and **MailChannels**. Set one of the two API keys (Resend is recommended for the free tier; see [EMAIL_PROVIDER_OPTIONS.md](./EMAIL_PROVIDER_OPTIONS.md)).

| Name | Type | Purpose |
|------|------|---------|
| `NOTIFY_BOARD_EMAIL` | Plain or Secret | Board notification recipient |
| `NOTIFY_ARB_EMAIL` | Plain or Secret | ARB notification recipient |
| `NOTIFY_NOREPLY_EMAIL` | Plain | From address for emails (e.g. `noreply@clrhoa.com`) |
| `RESEND_API_KEY` | **Secret** | Email via Resend (recommended; free tier). If set, used for all outgoing email. |
| `MAILCHANNELS_API_KEY` | **Secret** | Email via MailChannels. Used only when `RESEND_API_KEY` is not set. |
| `TWILIO_ACCOUNT_SID` | **Secret** | SMS (Twilio) |
| `TWILIO_AUTH_TOKEN` | **Secret** | SMS (Twilio) |
| `TWILIO_PHONE_NUMBER` | Plain | From number for SMS |

### Optional backup / Google Drive (only if you use those features)

| Name | Type | Purpose |
|------|------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | Plain or Secret | Backup download from Board |
| `CLOUDFLARE_BACKUP_API_TOKEN` | **Secret** | Backup download from Board + backup Worker |
| `D1_DATABASE_ID` | Plain | Backup (if different from binding) |
| `GOOGLE_CLIENT_ID` | **Secret** | Google Drive backup OAuth |
| `GOOGLE_CLIENT_SECRET` | **Secret** | Google Drive backup OAuth |
| `BACKUP_ENCRYPTION_KEY` | **Secret** | Encrypt backup payloads |

These are used by the **Pages** app when an admin uses Board → Backups. The **scheduled backup Worker** (if you run `npm run backup:deploy`) is a **separate** Worker project and has its own secrets (e.g. `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); you would set those in that Worker’s settings, not in the Pages project.

### Build-time (public) variables

These are read at **build** time and embedded into the client bundle. Set them in Pages → Environment variables for **Production** (and optionally Preview). They can be plain (non-secret) because they are exposed to the client.

- All `PUBLIC_*` variables (contact info, addresses, meeting location, dues, analytics, etc.) — see **Complete Variable List** and **Required Variables** below.
- `SITE` — site URL (e.g. `https://clrhoa.com`).
- `SITE_LAST_MODIFIED` — optional, for sitemap.

---

## Required Variables

### Form Configuration

- `PUBLIC_STATICFORMS_API_KEY` - StaticForms API key for contact form submissions ([staticforms.xyz](https://www.staticforms.xyz/))
- `PUBLIC_RECAPTCHA_SITE_KEY` - (Optional) reCAPTCHA v2 site key for the contact form; when set, the "I'm not a robot" widget is shown
- `RECAPTCHA_SECRET_KEY` - (Optional, server secret) reCAPTCHA v2 secret key; when set together with the site key, the contact API verifies the captcha and rejects submissions without a valid token. The API also verifies the hostname matches your domain (prevents token reuse). Set via `wrangler secret put RECAPTCHA_SECRET_KEY` or Cloudflare Pages → Settings → Environment variables (mark as secret)

## Contact Information (PII)

These variables contain Personally Identifiable Information (PII) and should be set in Cloudflare Pages, not committed to the repository.

### Security Contact

- `PUBLIC_SECURITY_EMAIL` - Email address for security.txt (e.g., `security@yourhoa.com`)

### Mailing Address

- `PUBLIC_MAILING_ADDRESS_NAME` - Organization name (e.g., `Crooked Lake Reserve HOA`)
- `PUBLIC_MAILING_ADDRESS_LINE1` - First line of address (e.g., `P.O. Box 1234`)
- `PUBLIC_MAILING_ADDRESS_LINE2` - Second line of address (e.g., `Your City, ST 12345`)

### Physical Address

- `PUBLIC_PHYSICAL_ADDRESS_STREET` - Street address (e.g., `123 Main St`)
- `PUBLIC_PHYSICAL_ADDRESS_CITY` - City name (e.g., `Your City`)
- `PUBLIC_PHYSICAL_ADDRESS_STATE` - State abbreviation (e.g., `FL`)
- `PUBLIC_PHYSICAL_ADDRESS_ZIP` - ZIP code (e.g., `12345`)

### Meeting Location

- `PUBLIC_MEETING_LOCATION` - Meeting venue name (e.g., `Community Center`)
- `PUBLIC_MEETING_ROOM` - Optional room name or number (e.g., `Room 3` or `Conference Room A`)
- `PUBLIC_MEETING_ADDRESS_STREET` - Street address (e.g., `456 Oak Ave`)
- `PUBLIC_MEETING_ADDRESS_CITY` - City name (e.g., `Your City`)
- `PUBLIC_MEETING_ADDRESS_STATE` - State abbreviation (e.g., `FL`)
- `PUBLIC_MEETING_ADDRESS_ZIP` - ZIP code (e.g., `12345`)

**Note**: If meeting address variables are provided, a "Get Directions" link will automatically appear on pages showing the meeting location.

## Optional Variables

### Analytics

- `PUBLIC_ANALYTICS_PROVIDER` - Set to `cloudflare` for Cloudflare Web Analytics (manual script install). Not needed if you use the one-click enable under Workers & Pages → [project] → Metrics.
- `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` - For Cloudflare Web Analytics (manual install): token UUID from Web Analytics → Manage site snippet. Not needed if you use the one-click enable under Workers & Pages → [project] → Metrics.

### Site Configuration

- `SITE` - Site URL (defaults to `https://clrhoa.com`)
- `SITE_LAST_MODIFIED` - Optional. ISO date string (e.g. `2025-02-04`) used as `lastmod` for static pages in `sitemap.xml`. If unset, build time is used.

### Waste Management & Recycling

These variables are optional and used to display waste management schedules and recycling center information on the Local Resources page.

**Pickup Schedules:**
- `PUBLIC_TRASH_SCHEDULE` - Trash pickup schedule (e.g., `Every Tuesday` or `Monday and Thursday`)
- `PUBLIC_RECYCLING_SCHEDULE` - Recycling pickup schedule (e.g., `Every other Tuesday`)

**Waste Management Contact:**
- `PUBLIC_WASTE_MANAGEMENT_CONTACT` - Name of waste management provider (e.g., `City of Eustis Waste Management`)
- `PUBLIC_WASTE_MANAGEMENT_PHONE` - Phone number for waste management (e.g., `(352) 123-4567`)
- `PUBLIC_WASTE_MANAGEMENT_WEBSITE` - Website URL for waste management services

**Recycling Center:**
- `PUBLIC_RECYCLING_CENTER_NAME` - Name of recycling center (e.g., `Lake County Recycling Center`)
- `PUBLIC_RECYCLING_CENTER_ADDRESS` - Full address of recycling center
- `PUBLIC_RECYCLING_CENTER_HOURS` - Operating hours (e.g., `Monday-Friday: 8 AM - 5 PM, Saturday: 9 AM - 2 PM`)
- `PUBLIC_RECYCLING_CENTER_PHONE` - Phone number for recycling center
- `PUBLIC_RECYCLING_CENTER_WEBSITE` - Website URL for recycling center

**Note**: If any waste management variables are provided, a dedicated "Waste Management & Recycling" section will appear at the top of the Local Resources page.

## Setup Instructions

### Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your values:
   ```bash
   # Contact Information (replace with your HOA's values)
   PUBLIC_SECURITY_EMAIL=security@yourhoa.com
   PUBLIC_MAILING_ADDRESS_NAME=Your HOA Name
   PUBLIC_MAILING_ADDRESS_LINE1=P.O. Box 1234
   PUBLIC_MAILING_ADDRESS_LINE2=Your City, ST 12345
   PUBLIC_PHYSICAL_ADDRESS_STREET=123 Main St
   PUBLIC_PHYSICAL_ADDRESS_CITY=Your City
   PUBLIC_PHYSICAL_ADDRESS_STATE=FL
   PUBLIC_PHYSICAL_ADDRESS_ZIP=12345
   PUBLIC_MEETING_LOCATION=Community Center
   PUBLIC_MEETING_ROOM=Room 3
   PUBLIC_MEETING_ADDRESS_STREET=456 Oak Ave
   PUBLIC_MEETING_ADDRESS_CITY=Your City
   PUBLIC_MEETING_ADDRESS_STATE=FL
   PUBLIC_MEETING_ADDRESS_ZIP=12345
   ```

3. Restart the dev server:
   ```bash
   npm run dev
   ```

### Production (Cloudflare Pages)

1. Go to Cloudflare Dashboard → Workers & Pages → your project
2. Navigate to **Settings** → **Environment variables**
3. Add all contact information variables:
   - `PUBLIC_SECURITY_EMAIL`
   - `PUBLIC_MAILING_ADDRESS_NAME`
   - `PUBLIC_MAILING_ADDRESS_LINE1`
   - `PUBLIC_MAILING_ADDRESS_LINE2`
   - `PUBLIC_PHYSICAL_ADDRESS_STREET`
   - `PUBLIC_PHYSICAL_ADDRESS_CITY`
   - `PUBLIC_PHYSICAL_ADDRESS_STATE`
   - `PUBLIC_PHYSICAL_ADDRESS_ZIP`
   - `PUBLIC_MEETING_LOCATION`
   - `PUBLIC_MEETING_ADDRESS_STREET` (optional, for directions)
   - `PUBLIC_MEETING_ADDRESS_CITY` (optional, for directions)
   - `PUBLIC_MEETING_ADDRESS_STATE` (optional, for directions)
   - `PUBLIC_MEETING_ADDRESS_ZIP` (optional, for directions)
4. Save and redeploy

## Security Notes

### Why Use Environment Variables?

- ✅ **Privacy Protection** - Sensitive information not in git history
- ✅ **Flexibility** - Easy to update without code changes
- ✅ **Security** - Reduces risk of exposing PII in repositories
- ✅ **Compliance** - Better alignment with privacy regulations

### What's Protected?

- Email addresses
- Mailing addresses
- Physical addresses
- Meeting locations

### Default Values

All variables have default fallback values in the code. However, **you should always set the actual values in Cloudflare Pages** for production.

## Files Using Environment Variables

- `src/pages/contact.astro` - Mailing address
- `src/pages/map.astro` - Physical address
- `src/pages/.well-known/security.txt.ts` - Security email
- `src/layouts/BaseLayout.astro` - Address in structured data
- `src/pages/about.astro` - Meeting location and address (with directions link)
- `src/pages/index.astro` - Meeting location and address (with directions link)
- `src/pages/board.astro` - Meeting location and address (with directions link)
- `src/pages/resources/local-resources.astro` - Waste management schedules and recycling center information

## Updating Values

### To Update Contact Information

1. Go to Cloudflare Pages → Settings → Environment variables
2. Update the relevant variable(s)
3. Save (this triggers a redeploy)
4. Verify the changes on the live site

### To Update Locally

1. Edit `.env.local`
2. Restart dev server: `npm run dev`
3. Verify changes locally

## Troubleshooting

### Public variables set in GitHub but not showing on the site

The site is **built in GitHub Actions**; the build step receives `PUBLIC_*` and `SITE` from **GitHub Variables** (not Secrets). If they are set in GitHub but the live site still shows placeholders or wrong data:

1. **Use Variables, not Secrets.** `vars.PUBLIC_MEETING_LOCATION` etc. only read from **Settings → Secrets and variables → Actions → Variables** (or **Environments → production → Environment variables**). If you added them as **Secrets**, the workflow cannot use them for build-time vars; move them to Variables (they are safe to be non-secret if they are `PUBLIC_*`).
2. **Environment scope.** The deploy job uses `environment: production`. If your variables are under **Environments → production → Environment variables**, they are available. If they are only under another environment (e.g. development), the production deploy won’t see them. Either add them to **Actions → Variables** (repository-wide) or to **production** environment variables.
3. **Check the deploy run.** After pushing or re-running the workflow, open the latest “Deploy to Cloudflare” run and look at the **Verify public env vars** step. It prints which of the main public vars are `set` or `missing`. If key vars show `missing`, add or fix them in GitHub (Variables, correct environment), then re-run the workflow.

### Variables Not Showing

- Verify variables are set in Cloudflare Pages (or in GitHub Variables if you deploy via Actions)
- Check variable names match exactly (case-sensitive)
- Ensure variables start with `PUBLIC_` for client-side access
- Redeploy after adding/updating variables

### Default Values Showing

- Check `.env.local` exists for local development
- Verify Cloudflare Pages environment variables are set
- Check variable names are correct
- Clear browser cache

## Best Practices

1. ✅ **Never commit `.env.local`** - Already in `.gitignore`
2. ✅ **Use `.env.example`** - Document all variables
3. ✅ **Set defaults** - Provide fallback values in code
4. ✅ **Document changes** - Update this file when adding variables
5. ✅ **Review regularly** - Check variables are still needed

## Variable Naming Convention

- All public variables start with `PUBLIC_` (required for Astro)
- Use uppercase with underscores
- Be descriptive (e.g., `PUBLIC_MAILING_ADDRESS_LINE1` not `PUBLIC_ADDR1`)

## Complete Variable List

```bash
# Form & Security
PUBLIC_STATICFORMS_API_KEY=
PUBLIC_RECAPTCHA_SITE_KEY=

# Contact Information (PII)
PUBLIC_SECURITY_EMAIL=
PUBLIC_MAILING_ADDRESS_NAME=
PUBLIC_MAILING_ADDRESS_LINE1=
PUBLIC_MAILING_ADDRESS_LINE2=
PUBLIC_PHYSICAL_ADDRESS_STREET=
PUBLIC_PHYSICAL_ADDRESS_CITY=
PUBLIC_PHYSICAL_ADDRESS_STATE=
PUBLIC_PHYSICAL_ADDRESS_ZIP=
PUBLIC_MEETING_LOCATION=
PUBLIC_MEETING_ROOM=
PUBLIC_MEETING_ADDRESS_STREET=
PUBLIC_MEETING_ADDRESS_CITY=
PUBLIC_MEETING_ADDRESS_STATE=
PUBLIC_MEETING_ADDRESS_ZIP=

# Waste Management & Recycling (Optional)
PUBLIC_TRASH_SCHEDULE=
PUBLIC_RECYCLING_SCHEDULE=
PUBLIC_WASTE_MANAGEMENT_CONTACT=
PUBLIC_WASTE_MANAGEMENT_PHONE=
PUBLIC_WASTE_MANAGEMENT_WEBSITE=
PUBLIC_RECYCLING_CENTER_NAME=
PUBLIC_RECYCLING_CENTER_ADDRESS=
PUBLIC_RECYCLING_CENTER_HOURS=
PUBLIC_RECYCLING_CENTER_PHONE=
PUBLIC_RECYCLING_CENTER_WEBSITE=

# Analytics (Optional - Cloudflare Web Analytics)
PUBLIC_ANALYTICS_PROVIDER=
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=

# Site Config
SITE=
```
