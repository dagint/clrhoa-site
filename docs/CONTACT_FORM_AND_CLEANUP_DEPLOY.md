# Contact Form – Deploy Checklist

**Note:** The contact-cleanup worker has been **deprecated** (2026-02-12). Cleanup is now handled by the backup worker. See `BACKUP_DEPLOYMENT_STATUS.md` for details.

---

## Contact Form Setup

The contact form at `/contact` logs submissions to the `contact_submissions` table (backup in case email fails) and sends email notifications.

### Required Secrets

#### .secrets.local (runtime / GitHub Secrets)

```bash
# reCAPTCHA secret key (get from https://www.google.com/recaptcha/admin)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here

# Email notification (Resend or MailChannels)
RESEND_API_KEY=your_resend_api_key  # Primary email service
NOTIFY_BOARD_EMAIL=board@clrhoa.com  # Where contact forms are sent
```

**Sync to GitHub:**
```bash
npm run secrets:setup  # Push to GitHub Secrets
```

**Sync to Cloudflare Pages:**
```bash
npm run secrets:sync  # Sync GitHub Secrets → Cloudflare Pages env vars
```

### Required Variables

#### .vars.local (build-time / GitHub Variables)

```bash
PUBLIC_RECAPTCHA_SITE_KEY=your_site_key_here  # Public reCAPTCHA site key
SITE=https://clrhoa.com  # Used for captcha hostname verification
```

---

## Database Table

The `contact_submissions` table must exist in D1:

```sql
CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient TEXT NOT NULL,
  email_sent INTEGER NOT NULL DEFAULT 0,
  email_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email_sent ON contact_submissions(email_sent);
```

**Create table:**
```bash
npm run db:contact-submissions  # Remote (production)
npm run db:contact-submissions:local  # Local dev
```

---

## Cleanup (Automated)

Contact form submissions older than 1 year are **automatically deleted** by the backup worker.

**No separate worker needed!** The backup worker (runs daily at 2:00 AM UTC) handles:
- D1 database backups
- KV whitelist backups
- R2 file backups
- **Data cleanup** (contact submissions >1 year, rate limits >7 days, directory logs >1 year)

See: `workers/backup/src/index.ts` → `cleanupOldData()` function

---

## Viewing Contact Submissions

Board members can view all contact form submissions at:
- **URL:** `/board/contacts`
- **Access:** Board role required
- **Data:** Shows submissions from the last 1 year (older submissions are auto-deleted)

---

## Testing

### Test Contact Form
1. Visit `/contact`
2. Fill out form and submit
3. Check email arrives at `NOTIFY_BOARD_EMAIL`
4. Verify submission logged in database:
   ```bash
   npx wrangler d1 execute clrhoa_db --remote \
     --command "SELECT * FROM contact_submissions ORDER BY created_at DESC LIMIT 5"
   ```

### Test Cleanup
The cleanup runs automatically with daily backups. To manually trigger:
```bash
curl -X POST https://clrhoa-backup.dagint.workers.dev/trigger \
  -H "Authorization: Bearer test-trigger-2024"
```

Check logs:
```bash
npx wrangler tail clrhoa-backup --format=pretty
```

---

## Troubleshooting

### Contact form not logging submissions
- ✅ Verify `contact_submissions` table exists (see Database Table section)
- ✅ Check D1 binding is configured in `wrangler.toml`

### Email not sending
- ✅ Verify `RESEND_API_KEY` is set in Cloudflare Pages environment variables
- ✅ Verify `NOTIFY_BOARD_EMAIL` is set
- ✅ Check email quota (Resend free tier: 100 emails/day)

### reCAPTCHA not working
- ✅ Verify `PUBLIC_RECAPTCHA_SITE_KEY` is set (build-time variable)
- ✅ Verify `RECAPTCHA_SECRET_KEY` is set (runtime secret)
- ✅ Check hostname matches in reCAPTCHA admin console

---

**Last Updated:** 2026-02-12
