# Analytics Setup Guide

This site supports privacy-friendly analytics that respect user privacy and comply with GDPR regulations.

## Supported Providers

### Plausible Analytics (Recommended)

Plausible is a privacy-friendly, GDPR-compliant analytics solution that:
- ✅ Doesn't use cookies
- ✅ Doesn't collect personal data
- ✅ Is GDPR, CCPA, and PECR compliant
- ✅ Provides simple, easy-to-understand metrics
- ✅ Is lightweight (~1KB script)

## Setup Instructions

### 1. Create a Plausible Account

1. Go to [plausible.io](https://plausible.io)
2. Sign up for an account
3. Add your domain (e.g., `clrhoa.com`)
4. Copy your domain name from the Plausible dashboard

### 2. Configure Environment Variables

#### Local Development

Create or update `.env.local`:

```bash
PUBLIC_ANALYTICS_PROVIDER=plausible
PUBLIC_PLAUSIBLE_DOMAIN=clrhoa.com
```

#### Production (Cloudflare Pages)

1. Go to Cloudflare Dashboard → Workers & Pages → your project
2. Navigate to **Settings** → **Environment variables**
3. Add the following variables:
   - `PUBLIC_ANALYTICS_PROVIDER` = `plausible`
   - `PUBLIC_PLAUSIBLE_DOMAIN` = `clrhoa.com`
4. Save and redeploy

### 4. Verify Setup

1. Deploy your site
2. Visit your site and navigate through a few pages
3. Check your Plausible dashboard (may take a few minutes to show data)
4. You should see page views appearing

## Disabling Analytics

To disable analytics, simply remove or don't set the `PUBLIC_ANALYTICS_PROVIDER` environment variable. The analytics script will not be loaded.

## Privacy Policy Considerations

If you enable analytics, consider adding a note to your privacy policy or about page:

> "We use privacy-friendly analytics that don't use cookies or collect personal data. All analytics are anonymized and comply with GDPR regulations."

## Alternative Analytics Providers

To add support for other analytics providers:

1. Create a new component in `src/components/` (e.g., `GoogleAnalytics.astro`)
2. Import and conditionally render it in `BaseLayout.astro`
3. Add environment variable checks similar to the Plausible setup

### Example: Google Analytics 4 (if needed)

```astro
---
const gaId = import.meta.env.PUBLIC_GA_ID;
---

{gaId && (
  <>
    <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}></script>
    <script is:inline>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '{gaId}');
    </script>
  </>
)}
```

**Note:** Google Analytics uses cookies and requires a cookie consent banner for GDPR compliance. Plausible is recommended for privacy-friendly analytics.

## Troubleshooting

### "We couldn't detect Plausible on your site"

- **Script must be in `<head>`** – This site places the Plausible script in the `<head>` (required by Plausible). If you customized the layout, ensure the Analytics component is inside `<head>`, not only in the body.
- **Environment variables at build time** – Cloudflare Pages bakes env vars into the build. Ensure `PUBLIC_ANALYTICS_PROVIDER`, `PUBLIC_PLAUSIBLE_DOMAIN`, and (if used) `PUBLIC_PLAUSIBLE_SCRIPT_SRC` are set for the environment you’re building (e.g. Production). Then trigger a new deploy so the build picks them up.
- **Exact values** – Use `plausible` (lowercase) for `PUBLIC_ANALYTICS_PROVIDER`. For `PUBLIC_PLAUSIBLE_SCRIPT_SRC`, use only the script URL (e.g. `https://plausible.io/js/script.xxxxx.js`); you can paste the full `<script ... src="...">` tag and the site will extract the URL.
- **CSP** – The site allows `https://plausible.io` in `script-src` and `connect-src`. If you added stricter CSP rules, ensure plausible.io is still allowed.
- **New script needs init** – If you use `PUBLIC_PLAUSIBLE_SCRIPT_SRC` (Plausible’s new snippet), the site automatically injects both the script tag and the `plausible.init()` call. You only need to set the script URL (e.g. `https://plausible.io/js/pa-xxxxx.js`).
- **View page source** – On the live site, open View Page Source and search for `plausible`. You should see in `<head>` either: (1) the new script: `<script async src="https://plausible.io/js/pa-...">` plus a small inline script with `plausible.init()`, or (2) the legacy script: `<script defer data-domain="..." src="https://plausible.io/js/script.js">`. If neither is there, the env vars weren’t available at build time or the domain/provider check failed.

### Analytics not showing data

- Verify environment variables are set correctly
- Check that the domain matches your Plausible configuration
- Ensure the site has been deployed with the environment variables
- Wait a few minutes for data to appear (Plausible updates in real-time but may have a slight delay)

### Script not loading

- Check browser console for errors
- Verify the domain is correctly configured in Plausible
- Ensure `PUBLIC_ANALYTICS_PROVIDER` is set to `plausible` (lowercase)
