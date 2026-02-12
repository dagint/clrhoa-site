# Analytics Setup Guide

This site supports privacy-friendly, cookie-free analytics.

## Cloudflare Web Analytics (recommended, free)

Cloudflare Web Analytics is free, doesn’t use cookies, and works well with Cloudflare Pages.

### Option A: One-click (no code or env vars)

If your site is deployed on **Cloudflare Pages**:

1. In the [Cloudflare Dashboard](https://dash.cloudflare.com), go to **Workers & Pages**.
2. Open your Pages project (e.g. clrhoa-site).
3. Open **Metrics** and under **Web Analytics** click **Enable**.

Cloudflare will inject the analytics script automatically on the next deployment. No environment variables or code changes are required.

### Option B: Manual script (token in env)

If you prefer to control the script in code (or use a site not on Pages):

1. In the [Cloudflare Dashboard](https://dash.cloudflare.com), go to **Web Analytics** (or [dash.cloudflare.com → Web Analytics](https://dash.cloudflare.com/?to=/:account/web-analytics)).
2. Click **Add a site** and enter your site’s hostname (e.g. `clrhoa.com` or `clrhoa-site.pages.dev`).
3. Open **Manage site** for that hostname and copy the **token** from the script snippet (the UUID in `data-cf-beacon='{"token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}'`).
4. Set environment variables:
   - **Cloudflare Pages:** Settings → Environment variables → Add:
     - `PUBLIC_ANALYTICS_PROVIDER` = `cloudflare`
     - `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` = your token (the UUID only).
   - **Local:** In `.env.local` add:
     ```bash
     PUBLIC_ANALYTICS_PROVIDER=cloudflare
     PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=your-token-uuid-here
     ```
5. Redeploy (or restart the dev server).

Data may take a few minutes to appear in the Web Analytics dashboard.

---

## Disabling analytics

Leave `PUBLIC_ANALYTICS_PROVIDER` unset (or remove it). No analytics script will be loaded. If you enabled Web Analytics via the one-click Pages option, turn it off under **Workers & Pages** → your project → **Metrics** → **Web Analytics**.

---

## Privacy

The privacy policy already mentions Cloudflare Web Analytics when enabled. No cookie banner is required.

---

## Troubleshooting

### Cloudflare: no data or script not loading

- **Option A:** Ensure Web Analytics is **Enabled** under **Workers & Pages** → [project] → **Metrics**.
- **Option B:** Check that `PUBLIC_ANALYTICS_PROVIDER=cloudflare` and `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` are set for the environment that’s built (e.g. Production), then redeploy.
- **View source:** Search for `cloudflareinsights` in the page source; you should see a script with `beacon.min.js` and your token in `data-cf-beacon`.
