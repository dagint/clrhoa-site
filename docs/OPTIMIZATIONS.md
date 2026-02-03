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

- **Enabled**: `minify: 'terser'` with compression options
- **Effect**: 
  - Removes console.log statements in production
  - Removes debugger statements
  - Minifies JavaScript code
- **Benefit**: Smaller JavaScript bundles, faster execution

### Asset Organization

- **Enabled**: `assets: '_assets'` in build config
- **Effect**: Organizes assets in a dedicated directory
- **Benefit**: Better caching and organization

### Inline Stylesheets

- **Enabled**: `inlineStylesheets: 'auto'` in build config
- **Effect**: Automatically inlines small stylesheets
- **Benefit**: Reduces HTTP requests for small CSS files

## Runtime Optimizations

### Image Preloading

- **Implementation**: `preloadImages` prop in `BaseLayout.astro`
- **Usage**: Critical images (like hero images) are preloaded
- **Benefit**: Faster initial page render

### Font Optimization

- **Implementation**: `preconnect` links for Google Fonts
- **Usage**: Preconnects to `fonts.googleapis.com` and `fonts.gstatic.com`
- **Benefit**: Faster font loading

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

1. **Convert to WebP**: Use WebP format for better compression
   - Current hero image: `placeholder-lake.jpg` (consider converting)
   - See `src/config/hero.ts` for image configuration

2. **Optimize Image Sizes**:
   - Hero images: 1920x1080px max
   - Keep file sizes under 300KB
   - Use appropriate image dimensions

3. **Responsive Images**: Consider using `srcset` for responsive images

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
