# Phase 3.5: Email + Twilio Notifications Setup

Configurable email (**Resend** or **MailChannels**) and SMS opt-in (Twilio). **No hardcoded emails** — all recipients come from `wrangler.toml` [vars] or secrets.

**Email provider:** The app uses **Resend** if `RESEND_API_KEY` is set (recommended free tier: 3,000 emails/month); otherwise it uses **MailChannels** if `MAILCHANNELS_API_KEY` is set. See [EMAIL_PROVIDER_OPTIONS.md](./EMAIL_PROVIDER_OPTIONS.md) for Google Workspace and other options.

---

## 1. Wrangler configuration

In **wrangler.toml** (or per-environment), set:

```toml
[vars]
NOTIFY_BOARD_EMAIL = "your_personal@gmail.com"
NOTIFY_ARB_EMAIL = "your_personal@gmail.com"
NOTIFY_NOREPLY_EMAIL = "noreply@clrhoa.com"
# Use Resend (free tier) or MailChannels — set one of:
# RESEND_API_KEY = "re_..."   # preferred for free tier
# MAILCHANNELS_API_KEY = "your_key"
TWILIO_ACCOUNT_SID = "your_sid"
TWILIO_AUTH_TOKEN = "your_token"
TWILIO_PHONE_NUMBER = "+15551234567"
```

- **NOTIFY_BOARD_EMAIL** — Receives public contact form and maintenance requests; change this to route board mail instantly without code changes.
- **NOTIFY_ARB_EMAIL** — Receives new ARB submission notifications.
- **NOTIFY_NOREPLY_EMAIL** — From address for outgoing mail (use a domain you control; verify it in Resend or MailChannels).
- **RESEND_API_KEY** — From [resend.com](https://resend.com) (recommended; free tier available). If set, the app uses Resend for all email.
- **MAILCHANNELS_API_KEY** — From MailChannels dashboard. Used only when RESEND_API_KEY is not set.
- **TWILIO_*** — For SMS opt-in and test messages.

For production, store secrets via:

```bash
wrangler secret put RESEND_API_KEY
# or
wrangler secret put MAILCHANNELS_API_KEY
wrangler secret put TWILIO_AUTH_TOKEN
```

Leave the rest in [vars] or override with secrets as needed.

---

## 2. Resend setup (recommended free option)

1. Sign up at [resend.com](https://resend.com) and create an **API key**.
2. In Resend dashboard, add your domain (e.g. `clrhoa.com`) and add the DNS records they show (SPF, DKIM, etc.). Until the domain is verified, you can send from their test address (see Resend docs).
3. Set `NOTIFY_NOREPLY_EMAIL` to an address on that domain (e.g. `noreply@clrhoa.com`).
4. Set `RESEND_API_KEY` in Cloudflare (vars or secret). The app will use Resend for all outgoing email.

---

## 3. MailChannels setup (DNS)

1. **Sign up** at [mailchannels.com](https://www.mailchannels.com/) and create an API key (or use the domain authentication flow).
2. **Domain authentication (required)**
   MailChannels requires a **Domain Lockdown** TXT record so only your Worker can send for your domain.

   Add a **TXT** record to your domain (e.g. `clrhoa.com`):

   - **Name/host:** `_mailchannels.clrhoa.com` (or `_mailchannels` for the root)
   - **Value:**
     `v=mc1 cfid=YOUR_WORKER_SUBDOMAIN.workers.dev`
     Replace `YOUR_WORKER_SUBDOMAIN` with your Cloudflare Workers/Pages subdomain (e.g. `clrhoa-site.pages.dev` or your custom domain that serves the Worker).

   If you use a **custom domain** for the site (e.g. `clrhoa.com`), use that in `cfid=`:

   - Example: `v=mc1 cfid=clrhoa.com`

   Without this record, sends will fail (often 500).

3. **From address**
   Set `NOTIFY_NOREPLY_EMAIL` to an address on a domain you control (e.g. `noreply@clrhoa.com`). Some providers require the domain to match the Domain Lockdown domain.

4. **API key**
   Create an API key in the MailChannels dashboard and set `MAILCHANNELS_API_KEY` in [vars] or as a secret. (Only used when `RESEND_API_KEY` is not set.)

---

## 4. Twilio setup (SMS)

1. Sign up at [twilio.com](https://www.twilio.com/).
2. Get **Account SID**, **Auth Token**, and a **Phone Number** from the console.
3. Set in [vars]: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (e.g. `+15551234567`).
4. For production, put `TWILIO_AUTH_TOKEN` in a secret:
   `wrangler secret put TWILIO_AUTH_TOKEN`

SMS is used for:
- **Portal → Preferences:** SMS opt-in checkbox + phone number; "Send test SMS" sends a test message via Twilio.

---

## 5. D1 migration (user preferences)

Run once (local or remote):

```bash
npm run db:phase35:local   # local D1
npm run db:phase35         # remote D1
```

This adds to the `users` table:

- `phone` (TEXT)
- `sms_optin` (INTEGER, 0/1)

If you run the migration twice, the second run will error with "duplicate column"; that is expected.

---

## 6. What sends where (all via env)

| Trigger | Recipient env var | Content |
|--------|--------------------|--------|
| Public contact form | `NOTIFY_BOARD_EMAIL` | Subject + name, email, message, recipient |
| New ARB request (submitted) | `NOTIFY_ARB_EMAIL` | Subject: New ARB Request #id; link to ARB dashboard |
| New maintenance request | `NOTIFY_BOARD_EMAIL` | Subject: New Maintenance #id; link to board maintenance |
| Directory rate limit / abuse | `NOTIFY_BOARD_EMAIL` | Directory abuse notice + user + IP |

Changing `NOTIFY_BOARD_EMAIL` or `NOTIFY_ARB_EMAIL` in [vars] (or secrets) changes where these go — no code change.

---

## 7. Optional: Twilio npm package

The app uses the **Twilio REST API over fetch** (no Node-only APIs), so the `twilio` npm package is not required for the Worker. If you want it for a local script or other tooling:

```bash
npm install twilio
```

---

## 8. Quick checklist

- [ ] [vars] (or secrets) set: `NOTIFY_BOARD_EMAIL`, `NOTIFY_ARB_EMAIL`, `NOTIFY_NOREPLY_EMAIL`, and either `RESEND_API_KEY` or `MAILCHANNELS_API_KEY`; Twilio vars if using SMS.
- [ ] If using Resend: domain verified in Resend dashboard. If using MailChannels: Domain Lockdown TXT record added for your domain / Worker hostname.
- [ ] `NOTIFY_NOREPLY_EMAIL` uses a domain you control and is verified in your chosen provider (Resend or MailChannels).
- [ ] D1 migration `db:phase35` (or `db:phase35:local`) run once.
- [ ] Public contact form submits to `/api/contact` (default when StaticForms key is not set).
- [ ] Portal **Preferences** page: SMS opt-in and "Send test SMS" work when Twilio vars are set.
