# Email provider options for notifications

The portal and contact form send email via a configurable provider. This doc compares options so you can choose one that fits your budget and needs.

---

## Quick recommendation

- **Best fit for purpose (and free tier):** Use **Resend** or **SendGrid** for transactional/notification email. Both have free tiers and are built for deliverability and low spam risk.
- **If you already have Google Workspace:** You *can* send via Gmail SMTP for low volume (e.g. &lt; 100–200 emails/day). It works but is not ideal for “notification” traffic and can affect domain reputation if volume grows.

---

## Option 1: Resend (recommended free option)

- **Free tier:** 3,000 emails/month, 100/day.
- **Purpose-built** for transactional email (password resets, notifications, contact form).
- **Setup:** Sign up at [resend.com](https://resend.com), create an API key, add your domain (or use their test domain at first). Set `RESEND_API_KEY` in Cloudflare secrets; the app will use Resend when this is set.
- **From address:** Use `NOTIFY_NOREPLY_EMAIL` (e.g. `noreply@clrhoa.com`). Verify the domain in Resend’s dashboard so “from” is your domain.

---

## Option 2: SendGrid

- **Free tier:** 100 emails/day forever.
- **Purpose-built** for transactional and marketing email.
- **Setup:** Sign up at [sendgrid.com](https://sendgrid.com), create an API key, verify your domain. You would add a `SENDGRID_API_KEY` (and optionally wire it in code if we add SendGrid support).
- Good if you prefer a well-known name; free tier is smaller than Resend’s.

---

## Option 3: Google Workspace (Gmail) SMTP

- **Can you use it?** Yes. You can send from a Google Workspace account via SMTP (e.g. `board@clrhoa.com` or `noreply@clrhoa.com` if you use Workspace).
- **Limits:** About 2,000 emails/day per Workspace account (500 for free Gmail).
- **Pros:** You may already have it; no extra signup.
- **Cons:**
  - Not designed for automated/transactional volume. High or bursty sending can trigger limits or spam flags.
  - Your domain’s reputation is tied to that inbox; if many people mark messages as spam, it can affect deliverability for all mail from that account.
  - No built-in open/bounce tracking or dedicated IP.
- **Verdict:** Acceptable for **low volume** (e.g. contact form + a few dozen portal notifications per day). For more volume or a more “professional” notification pipeline, use Resend or SendGrid instead.

If you want to use Google SMTP, we can add SMTP support to the app (e.g. via `Nodemailer` or a small SMTP client) and configure it with your Workspace credentials; the app would then send through Gmail instead of (or as a fallback to) an API provider.

---

## Option 4: MailChannels

- **Current integration:** The app was first built to use MailChannels. MailChannels no longer offers a general free tier for arbitrary use; they focus on Cloudflare and other partners with specific plans.
- If you have a MailChannels plan and API key, you can keep using it by setting `MAILCHANNELS_API_KEY` and `NOTIFY_NOREPLY_EMAIL` as in [PHASE35_NOTIFICATIONS_SETUP.md](./PHASE35_NOTIFICATIONS_SETUP.md).

---

## How the app chooses a provider

- If **`RESEND_API_KEY`** is set in your environment (e.g. Cloudflare secrets), the app uses **Resend** for all outgoing email.
- Otherwise, if **`MAILCHANNELS_API_KEY`** is set, the app uses **MailChannels**.
- If neither is set, contact form and notification emails are not sent (you’ll see a “not configured” or send failure).

To switch to Resend: add your Resend API key as a secret and remove or leave the MailChannels key; the app will use Resend.

---

## Summary

| Option           | Free tier        | Best for                          |
|------------------|------------------|------------------------------------|
| **Resend**       | 3,000/month      | Notifications + contact form ✅   |
| **SendGrid**     | 100/day          | Notifications + contact form      |
| **Google SMTP**  | 500–2000/day     | Low volume only                    |
| **MailChannels** | Paid/partner     | If you already have a plan        |

**Recommendation:** Use **Resend** (or SendGrid) for notifications and the contact form. Use **Google Workspace** only if you already have it and send very little mail; otherwise prefer a dedicated transactional provider.
