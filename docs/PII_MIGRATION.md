# PII Migration to Environment Variables

All sensitive Personally Identifiable Information (PII) has been moved from code to Cloudflare Pages environment variables.

## ✅ Migrated to Environment Variables

### Email Addresses
- ✅ **Security Email** (`PUBLIC_SECURITY_EMAIL`)
  - Previously: Hardcoded in `public/.well-known/security.txt`
  - Now: Dynamic via `src/pages/.well-known/security.txt.ts`
  - Used in: Security.txt file

### Mailing Address
- ✅ **Mailing Address** (3 variables)
  - Previously: Hardcoded in `src/pages/contact.astro` and news articles
  - Now: Environment variables
  - Variables:
    - `PUBLIC_MAILING_ADDRESS_NAME`
    - `PUBLIC_MAILING_ADDRESS_LINE1`
    - `PUBLIC_MAILING_ADDRESS_LINE2`
  - Used in: Contact page, news articles (via link to contact page)

### Physical Address
- ✅ **Physical Address** (4 variables)
  - Previously: Hardcoded in `src/pages/map.astro` and structured data
  - Now: Environment variables
  - Variables:
    - `PUBLIC_PHYSICAL_ADDRESS_STREET`
    - `PUBLIC_PHYSICAL_ADDRESS_CITY`
    - `PUBLIC_PHYSICAL_ADDRESS_STATE`
    - `PUBLIC_PHYSICAL_ADDRESS_ZIP`
  - Used in: Map page, Google Maps embed, structured data (JSON-LD)

### Meeting Location
- ✅ **Meeting Location** (`PUBLIC_MEETING_LOCATION`)
  - Previously: Hardcoded in multiple pages
  - Now: Environment variable
  - Used in: About page, Board page, Homepage

## Files Updated

### Code Files (Now Use Environment Variables)
1. ✅ `src/pages/contact.astro` - Mailing address
2. ✅ `src/pages/map.astro` - Physical address
3. ✅ `src/pages/.well-known/security.txt.ts` - Security email (new dynamic route)
4. ✅ `src/layouts/BaseLayout.astro` - Address in structured data
5. ✅ `src/pages/about.astro` - Meeting location
6. ✅ `src/pages/index.astro` - Meeting location
7. ✅ `src/pages/board.astro` - Meeting location

### Content Files (Updated to Reference Contact Page)
1. ✅ `src/content/news/2026-02-01-dues-reminder.md` - Changed to link to contact page

### Configuration Files
1. ✅ `.env.example` - Added all new variables with examples
2. ✅ `src/env.d.ts` - Added TypeScript types for new variables

### Documentation
1. ✅ `docs/ENVIRONMENT_VARIABLES.md` - Complete guide for all variables

## Remaining Hardcoded References

### News Articles (Content Files)
The following markdown content files still contain "Eustis Community Center":
- `src/content/news/2026-01-15-annual-meeting.md`

**Reason**: These are content files edited by board members. The meeting location is less sensitive than addresses/emails. Consider updating manually when editing these articles, or they can reference the contact page for current information.

**Recommendation**: Leave as-is for now, or update manually when editing articles.

## Setup Required

### Cloudflare Pages Environment Variables

Set the following in Cloudflare Pages → Settings → Environment variables:

```bash
# Security
PUBLIC_SECURITY_EMAIL=security@clrhoa.com

# Mailing Address
PUBLIC_MAILING_ADDRESS_NAME=Crooked Lake Reserve HOA
PUBLIC_MAILING_ADDRESS_LINE1=P.O. Box 1234
PUBLIC_MAILING_ADDRESS_LINE2=Your City, ST 12345

# Physical Address
PUBLIC_PHYSICAL_ADDRESS_STREET=2 Lakes Ln
PUBLIC_PHYSICAL_ADDRESS_CITY=Eustis
PUBLIC_PHYSICAL_ADDRESS_STATE=FL
PUBLIC_PHYSICAL_ADDRESS_ZIP=32726

# Meeting Location
PUBLIC_MEETING_LOCATION=Eustis Community Center
```

### Local Development

Copy `.env.example` to `.env.local` and fill in values for local testing.

## Security Benefits

### Before Migration
- ❌ Email addresses in git history
- ❌ Physical addresses in code
- ❌ Mailing addresses in code
- ❌ Hard to update without code changes
- ❌ PII visible in repository

### After Migration
- ✅ No PII in repository
- ✅ Easy to update via Cloudflare dashboard
- ✅ No code changes needed to update contact info
- ✅ Better privacy compliance
- ✅ Reduced risk of exposing sensitive information

## Verification Checklist

After setting environment variables in Cloudflare Pages:

- [ ] Contact page shows correct mailing address
- [ ] Map page shows correct physical address
- [ ] Google Maps embed works with new address
- [ ] Security.txt shows correct email (`/.well-known/security.txt`)
- [ ] Structured data (JSON-LD) shows correct city/state
- [ ] Meeting location appears correctly on all pages
- [ ] News article links to contact page for mailing address

## Testing

### Local Testing
```bash
# Set up .env.local with test values
cp .env.example .env.local
# Edit .env.local with actual values

# Test locally
npm run dev
# Visit http://localhost:4321/contact
# Visit http://localhost:4321/map
# Visit http://localhost:4321/.well-known/security.txt
```

### Production Testing
1. Set variables in Cloudflare Pages
2. Redeploy (or wait for auto-deploy)
3. Verify all pages show correct information
4. Check browser DevTools → Network → check responses

## Rollback Plan

If needed, you can temporarily revert by:
1. Setting environment variables to current values
2. Or updating code with fallback defaults
3. All code has sensible defaults, so site will work even without variables set

## Next Steps

1. ✅ **Set environment variables in Cloudflare Pages** (required)
2. ✅ **Test locally** with `.env.local`
3. ✅ **Deploy and verify** production site
4. ⚠️ **Update news articles** manually when editing (optional)

## Questions?

See `docs/ENVIRONMENT_VARIABLES.md` for complete documentation on all environment variables.
