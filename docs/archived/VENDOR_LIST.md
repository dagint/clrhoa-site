# Vendor List Management Guide

This guide explains how to add and manage vendors on the Vendor List page.

## Overview

The Vendor List page (`/resources/vendors`) displays vendor names with website links when available. For vendors without websites, residents can request contact information through a secure contact form.

## Adding Vendors

Vendors are managed in `src/pages/resources/vendors.astro`. To add a vendor:

1. Open `src/pages/resources/vendors.astro`
2. Find the `vendors` array (around line 6)
3. Add a new vendor object following this format:

```javascript
{
  name: 'Vendor Name',
  category: 'Category Name',
  website: 'https://vendor-website.com', // or null if no website
}
```

### Example

```javascript
const vendors = [
  {
    name: 'ABC Landscaping',
    category: 'Landscaping & Lawn Care',
    website: 'https://abc-landscaping.com',
  },
  {
    name: 'Local Pest Control',
    category: 'Pest Control',
    website: null, // No website - will show "Request Contact Info" button
  },
];
```

## Vendor Categories

Available categories:
- `Landscaping & Lawn Care`
- `Pest Control`
- `Roofing & Exterior`
- `HVAC & Plumbing`
- `Electrical Services`
- `Painting & Pressure Washing`
- `Pool & Spa Services`
- `General Contractors`
- `Insurance`
- `Legal Services`

## How It Works

### Vendors WITH Websites
- Vendor name is displayed
- A "Visit Website" link appears
- Link opens in a new tab with security attributes

### Vendors WITHOUT Websites
- Vendor name is displayed
- A "Request Contact Info" button appears
- Clicking the button opens the contact form with:
  - Recipient pre-selected as "Vendor Information Request"
  - Message pre-filled with vendor name
- Resident completes the form and submits
- Board receives the request and can respond with vendor contact information

## Security Features

- ✅ **No email addresses or phone numbers** exposed on the website
- ✅ **Website links only** - safer than exposing direct contact info
- ✅ **Secure contact form** for requesting information
- ✅ **Board can verify requests** before sharing vendor contact details
- ✅ **Protects vendors** from spam, scams, and unwanted solicitations

## Best Practices

1. **Only add vendors** that have been used by community residents
2. **Verify website URLs** before adding them
3. **Use consistent naming** for vendor names
4. **Group vendors** by appropriate categories
5. **Remove vendors** if they're no longer recommended
6. **Update regularly** to keep the list current

## Updating the List

1. Edit `src/pages/resources/vendors.astro`
2. Update the `vendors` array
3. Commit and push to GitHub
4. Cloudflare Pages will automatically deploy the changes

## Example: Complete Vendor Entry

```javascript
{
  name: 'Smith Roofing & Repair',
  category: 'Roofing & Exterior',
  website: 'https://smithroofing.com',
}
```

This will display as:
- **Name:** Smith Roofing & Repair
- **Category:** Roofing & Exterior
- **Link:** "Visit Website" (opens smithroofing.com)

## Example: Vendor Without Website

```javascript
{
  name: 'Local Electrician',
  category: 'Electrical Services',
  website: null,
}
```

This will display as:
- **Name:** Local Electrician
- **Category:** Electrical Services
- **Button:** "Request Contact Info" (opens contact form pre-filled)

## Notes

- The HOA does not endorse any specific vendor
- Residents should always verify licenses, insurance, and references
- Some work may require ARB approval - check the Documents page
- Residents can suggest new vendors through the contact form
