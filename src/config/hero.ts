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
 * Image paths (from public/). Use one or more, e.g.:
 * ['/clr-lake-ducie.webp', '/clr-sign.webp', '/clr-tree.webp']
 *
 * Note: For best performance, use WebP format and keep file sizes under ~300KB.
 */
export const heroImages: string[] = ['/clr-lake-ducie.webp', '/clr-sign.webp', '/clr-tree.webp'];
