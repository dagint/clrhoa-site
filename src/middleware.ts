/**
 * Astro Middleware for Security Headers
 * 
 * This middleware adds security headers to all responses.
 * For Cloudflare Pages, headers can also be configured in:
 * - Cloudflare Dashboard → Pages → your project → Settings → Headers
 * 
 * Note: Some headers may be better configured at Cloudflare level
 * for better performance and caching.
 */

import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();
  
  // Skip middleware during static generation if headers are not available
  // Check if response exists and has headers property that is a Headers object
  if (!response || typeof response.headers === 'undefined' || !(response.headers instanceof Headers)) {
    return response;
  }
  
  try {
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // HSTS - Only set for HTTPS (Cloudflare handles this, but good to have)
    if (context.url.protocol === 'https:') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Content Security Policy
    // form-action: StaticForms (contact form); script-src/frame-src: reCAPTCHA (optional)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.staticforms.dev https://challenges.cloudflare.com https://cloudflareinsights.com https://www.google.com",
      "frame-src 'self' https://www.google.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://api.staticforms.dev",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ');
    
    response.headers.set('Content-Security-Policy', csp);
  } catch (error) {
    // If setting headers fails (e.g., during static generation), return response as-is
    // Headers will be set at runtime or via Cloudflare configuration
    console.warn('Failed to set security headers in middleware:', error);
  }
  
  return response;
};
