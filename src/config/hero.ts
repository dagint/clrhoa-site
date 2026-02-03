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
export const heroRotate = false;

/**
 * Image paths (from public/). Use one or more, e.g.:
 * ['/placeholder-lake.jpg']
 * ['/images/hero1.webp', '/images/hero2.webp', '/images/hero3.webp']
 * 
 * Note: For best performance, convert images to WebP format and optimize file sizes.
 */
export const heroImages: string[] = ['/placeholder-lake.jpg'];
