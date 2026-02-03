# Contact Form Setup (StaticForms)

The contact page uses **StaticForms** for form handling. StaticForms does not support Cloudflare Turnstile; it offers **reCAPTCHA**, **ALTCHA**, or **honeypot-only** for spam protection.

---

## 1. StaticForms account and API key

1. Sign up at [StaticForms](https://www.staticforms.xyz/) (or [staticforms.dev/register](https://www.staticforms.dev/register)).
2. Verify your email and open the dashboard.
3. Copy your **API key** (used as `PUBLIC_STATICFORMS_API_KEY`).
4. In the dashboard, set the **email** where submissions should be sent.

---

## 2. Setting up the three choices (Board, ARB, Vendor)

The contact form has a dropdown **“I would like to contact:”** with three options:

- **Board of Directors**
- **Architectural Review Board (ARB)**
- **Vendor Information Request**

### How it works in StaticForms

You do **not** create three separate forms or three API keys in StaticForms. You use **one** StaticForms form (one API key, one destination email).

- Every submission is sent to the **same email** you set in the StaticForms dashboard (e.g. a general board or contact inbox).
- Each submission includes a **recipient** field in the email body, for example:
  - `recipient: board` → Board of Directors  
  - `recipient: arb` → Architectural Review Board (ARB)  
  - `recipient: vendor` → Vendor Information Request  

So the three “choices” are already built into the form; StaticForms just delivers one stream of emails with that field in each one.

### What you need to do

1. In the **StaticForms dashboard**, set the **one email address** that should receive all contact form submissions (e.g. `board@yourhoa.com` or a shared inbox).
2. When you receive an email, read the **recipient** (or “I would like to contact”) line to see whether it’s for the Board, ARB, or a vendor request.
3. Triage as you normally would (e.g. forward ARB messages to the ARB, handle vendor requests from the same inbox or forward to the right person).

No extra setup is required in StaticForms for Board vs ARB vs Vendor; the dropdown only affects what appears in the submission, not where the email is sent.

---

## 3. Spam protection (choose one)

### Option A: Honeypot only (default)

- The form includes a hidden **honeypot** field. No extra keys or widgets.
- Set only `PUBLIC_STATICFORMS_API_KEY`. Leave `PUBLIC_RECAPTCHA_SITE_KEY` empty.

### Option B: reCAPTCHA v2

1. Get [reCAPTCHA v2 keys](https://www.google.com/recaptcha/admin) (checkbox “I’m not a robot”).
2. Add your domain (and `localhost` for testing) in the reCAPTCHA admin.
3. In **StaticForms dashboard** → **CAPTCHA settings**: choose **reCAPTCHA**, enter your **Secret key** (not the site key), save.
4. In the site: set `PUBLIC_RECAPTCHA_SITE_KEY` to your **Site key**. The contact form will show the reCAPTCHA widget.

### Option C: ALTCHA (Pro)

- In StaticForms dashboard, enable **ALTCHA** and follow their [ALTCHA docs](https://www.staticforms.xyz/docs/spam-protection). No Google account; privacy-focused. Add the ALTCHA widget to the form if you use this (see StaticForms docs).

---

## 4. Environment variables

### Local

Create or update `.env.local`:

```bash
PUBLIC_STATICFORMS_API_KEY=your_staticforms_api_key

# Optional – only if you use reCAPTCHA (Option B)
PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

Restart the dev server (`npm run dev`) after changing env vars.

### Production (Cloudflare Pages)

1. **Workers & Pages** → your project → **Settings** → **Environment variables**.
2. Add:
   - `PUBLIC_STATICFORMS_API_KEY` = your StaticForms API key  
   - `PUBLIC_RECAPTCHA_SITE_KEY` = (optional) your reCAPTCHA site key if using reCAPTCHA  
3. Save and **redeploy**.

---

## 5. Behavior

- **Contact page** (`/contact`): If `PUBLIC_STATICFORMS_API_KEY` is set, the “Send a message” form is shown. Submissions POST to `https://api.staticforms.dev/submit`.
- **Recipient types**: The form sends a **recipient** field (Board, ARB, Vendor request). All submissions go to the same email; you route by reading that field.
- **Thank-you page**: On success, StaticForms redirects to `/contact/thanks` (via hidden field `redirectTo`).
- **Honeypot**: A hidden field named `honeypot` is used for bot detection (and is stripped from the email).

---

## 6. Testing

- **Local**: Set `PUBLIC_STATICFORMS_API_KEY` in `.env.local`, run `npm run dev`, open `/contact`, submit the form. Confirm redirect to `/contact/thanks` and the submission in your email and StaticForms dashboard.
- **Production**: After deploy, submit from the live contact page and check email and dashboard.

---

## 7. Troubleshooting

| Issue | Check |
|-------|--------|
| No form on /contact | `PUBLIC_STATICFORMS_API_KEY` must be set. |
| reCAPTCHA not visible | `PUBLIC_RECAPTCHA_SITE_KEY` set; domain (and localhost) allowed in reCAPTCHA admin. |
| Submissions not received | Valid API key; StaticForms dashboard email; browser network tab for POST to api.staticforms.dev. |
| Redirect not working | Form has hidden `redirectTo` with full thanks URL (e.g. `https://yoursite.com/contact/thanks`). |

---

## 8. Summary

1. Create a StaticForms account and get your **API key**.  
2. Set **email** in StaticForms dashboard.  
3. Choose spam protection: **honeypot-only**, **reCAPTCHA**, or **ALTCHA** (Pro); if reCAPTCHA, set secret in StaticForms and `PUBLIC_RECAPTCHA_SITE_KEY` on the site.  
4. Set `PUBLIC_STATICFORMS_API_KEY` (and optionally `PUBLIC_RECAPTCHA_SITE_KEY`) in `.env.local` and Cloudflare Pages.  
5. Redeploy and test the contact flow.
