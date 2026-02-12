# Canonical URLs and Noindex

This document describes how the site uses canonical URLs and `noindex` so search engines index the right pages and skip utility pages.

## Rule

- **Indexable pages**: Have a canonical URL pointing to themselves (the page URL) and no `robots` noindex (default behavior).
- **Utility / one-off pages**: Use **canonical self** (same URL) and **`noindex, follow`** so search engines don’t index them but can still follow links.

## Pages with noindex

These pages set `noindex={true}` in the layout so they get `<meta name="robots" content="noindex, follow">`. The canonical URL is still the page’s own URL.

| Page | Reason |
|------|--------|
| **404** (`/404.html`) | Error page; not useful in search results. |
| **Contact thank-you** (`/contact/thanks`) | Post-submit confirmation; duplicate of contact intent, no unique content to index. |

## Adding noindex to a new page

1. Use `BaseLayout` and pass the `noindex` prop:
   ```astro
   <BaseLayout title="..." noindex={true}>
   ```
2. Do **not** add the page to `sitemap.xml` (it already omits `/contact/thanks` and 404).

## Canonical

- Every page has a canonical URL (via `BaseLayout`) set to the current page URL (`Astro.url` with `Astro.site`).
- There is no cross-page canonical (e.g. we don’t canonical a duplicate to another URL); we only set canonical to self.

## Sitemap

- Only indexable pages are listed in `sitemap.xml`.
- 404 and `/contact/thanks` are intentionally omitted.
