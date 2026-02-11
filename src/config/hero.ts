/**
 * Hero section on the front page.
 * Toggle rotation on/off and set which images to use.
 *
 * Image Optimization Tips:
 * - Use WebP format for better compression (e.g., '/images/hero.webp')
 * - Recommended sizes: 1920x1080px for hero images
 * - Keep file sizes under 300KB for optimal performance
 * - Consider using srcset for responsive images if switching to <img> tags
 */

/** Set to true to rotate through multiple hero images; false to show a single static image. */
export const heroRotate = true;

/**
 * Image paths (from public/). Optimized outputs go in public/hero/ via npm run optimize:hero.
 * Example: ['/hero/clr-lake-ducie.webp', '/hero/clr-sign.webp', '/hero/clr-tree.webp']
 *
 * Note: For best performance, run optimize:hero so images are resized and re-encoded (~300–500KB each).
 */
export const heroImages: string[] = [
  '/hero/clr-lake-ducie.webp',
  '/hero/clr-sign.webp',
  '/hero/clr-tree.webp',
  '/hero/clr-drone1.webp',
  '/hero/clr-drone2.webp'
];
