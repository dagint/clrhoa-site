# Environment Variables Guide

This site uses environment variables to store sensitive information and configuration that shouldn't be committed to the repository.

## Required Variables

### Form Configuration

- `PUBLIC_STATICFORMS_API_KEY` - StaticForms API key for contact form submissions ([staticforms.xyz](https://www.staticforms.xyz/))
- `PUBLIC_RECAPTCHA_SITE_KEY` - (Optional) reCAPTCHA site key if you enable reCAPTCHA in StaticForms dashboard; otherwise honeypot-only is used

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

- `PUBLIC_ANALYTICS_PROVIDER` - Analytics provider (e.g., `plausible`)
- `PUBLIC_PLAUSIBLE_DOMAIN` - Plausible domain; must match the domain in Plausible (e.g., `clrhoa.com` or `clrhoa-site.pages.dev`)
- `PUBLIC_PLAUSIBLE_SCRIPT_SRC` - (Optional) New Plausible script URL from Site Installation; when set, replaces the legacy script

### Site Configuration

- `SITE` - Site URL (defaults to `https://clrhoa.com`)

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

### Variables Not Showing

- Verify variables are set in Cloudflare Pages
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

# Analytics (Optional)
PUBLIC_ANALYTICS_PROVIDER=
PUBLIC_PLAUSIBLE_DOMAIN=

# Site Config
SITE=
```
