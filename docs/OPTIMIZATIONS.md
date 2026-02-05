# Performance Optimizations

This document outlines the performance optimizations implemented in the site.

## Build Optimizations

### HTML Compression

- **Enabled**: `compressHTML: true` in `astro.config.mjs`
- **Effect**: Removes unnecessary whitespace and comments from HTML output
- **Benefit**: Smaller file sizes, faster page loads

### CSS Optimization

- **Enabled**: `cssMinify: true` in Vite build config
- **Effect**: Minifies CSS output
- **Benefit**: Reduced CSS file size

### JavaScript Minification

- **Enabled**: `minify: 'esbuild'` in Vite build config
- **Effect**: Minifies JavaScript bundles
- **Benefit**: Smaller JavaScript bundles, faster execution

### Asset Organization

- **Enabled**: `assets: '_assets'` in build config
- **Effect**: Organizes assets in a dedicated directory
- **Benefit**: Better caching and organization

### Inline Stylesheets

- **Enabled**: `inlineStylesheets: 'auto'` in build config
- **Effect**: Automatically inlines small stylesheets
- **Benefit**: Reduces HTTP requests for small CSS files

### Post-build: Defer all CSS on homepage

- **Issue**: Astro’s CSS code-splitting injects multiple page CSS chunks (e.g. about + emergency-contacts) into `index.html`, causing render-blocking requests.
- **Fix**: `scripts/defer-index-css.js` runs as `postbuild` and makes **all** `/_assets/*.css` stylesheets on `dist/index.html` non-blocking (`media="print"` then `onload="this.media='all'"`). No CSS blocks initial render; LCP (hero image) paints immediately. A `<noscript>` block is added so users without JS still get styles.

## Runtime Optimizations

### Image Preloading

- **Implementation**: `preloadImages` prop in `BaseLayout.astro`
- **Usage**: Critical images (like hero images) are preloaded
- **Benefit**: Faster initial page render

### Font Optimization

- **Implementation**: `preconnect` + async font stylesheet loading in `BaseLayout.astro`
- **Usage**: Font CSS is loaded with `rel="preload" as="style"` and applied via `onload` so it does not block initial render; `display=swap` keeps text visible immediately
- **Benefit**: Reduces render-blocking time; preconnect still speeds the font request when it runs

### Lazy Loading

- **Recommendation**: Use `loading="lazy"` for below-the-fold images
- **Current**: Hero images are preloaded (above the fold)
- **Future**: Consider lazy loading for document thumbnails or gallery images

## Content Delivery

### Static Site Generation

- **Type**: Static site (SSG)
- **Benefit**: Pre-rendered HTML, instant page loads
- **Deployment**: Cloudflare Pages with global CDN

### Caching

- **Headers**: Cache-Control headers set via middleware
- **Sitemap**: Cached for 1 hour
- **robots.txt**: Cached for 1 hour
- **Benefit**: Reduced server load, faster repeat visits

## Recommendations

### Image Optimization

1. **Hero images (critical for LCP)**:
   - Format: WebP (see `src/config/hero.ts`)
   - Max dimensions: 1920×1080px (or 1920×1280 for taller hero)
   - **Target file size: under 300KB each.** Lighthouse flags images over ~500KB; 2–5 MB hero images add several seconds to load.
   - **Build step:** Run `npm run optimize:hero` before deploy (uses `sharp` to resize to max 1920px and re-encode WebP at quality 82). Requires `npm install` (sharp is a devDependency).
   - Manual: [Squoosh](https://squoosh.app) (WebP, quality 80–85), or `cwebp -q 82 -resize 1920 0 input.jpg -o hero.webp`

2. **Current behavior**:
   - Only the first hero image is preloaded and used for LCP; 2nd and 3rd slides load when the carousel reaches them (lazy-loaded).

3. **Responsive images**: If switching to `<img>` tags, use `srcset` for responsive hero images.

### Code Splitting

- **Current**: Single bundle (acceptable for small site)
- **Future**: Consider code splitting if site grows significantly

### Service Worker (Future)

- Consider adding a service worker for offline support
- Cache static assets for faster repeat visits

## Monitoring

### Performance Metrics

Monitor these metrics:
- **LCP** (Largest Contentful Paint): Target < 2.5s
- **FID** (First Input Delay): Target < 100ms
- **CLS** (Cumulative Layout Shift): Target < 0.1

### Tools

- [PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)
- Browser DevTools Performance tab

## Current Performance

The site is optimized for:
- ✅ Fast initial page loads
- ✅ Small bundle sizes
- ✅ Efficient asset delivery
- ✅ Good caching strategy

## Related Documentation

- [Deployment Guide](DEPLOYMENT.md) - Deployment configuration
- [Security Guide](SECURITY.md) - Security headers and optimizations
