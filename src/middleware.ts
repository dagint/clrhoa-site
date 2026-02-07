/**
 * Astro Middleware: portal auth + security headers.
 * - /portal/* (except /portal/login): require session cookie or redirect to login.
 * - Profile completeness: redirect to /portal/profile?required=1 before any response is sent (avoids ResponseSentError from component redirect).
 * - Security headers on all responses.
 */

import type { MiddlewareHandler } from 'astro';
import { getSessionFromCookie, SESSION_COOKIE_NAME } from './lib/auth';
import { getOwnerByEmail, getPhonesArray } from './lib/directory-db';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname;

  // Portal: require session cookie for all routes except login
  if (pathname.startsWith('/portal')) {
    if (pathname === '/portal/login' || pathname === '/portal/login/') {
      // If already logged in, redirect to dashboard
      if (context.cookies.has(SESSION_COOKIE_NAME)) {
        return context.redirect('/portal/dashboard');
      }
    } else {
      // Protected portal route: no cookie => login
      if (!context.cookies.has(SESSION_COOKIE_NAME)) {
        return context.redirect('/portal/login');
      }
      // Profile completeness: redirect before any response is sent (avoids "response already sent" when component would redirect)
      const isProfilePage = pathname === '/portal/profile' || pathname === '/portal/profile/';
      if (!isProfilePage) {
        const env = (context.locals as { runtime?: { env?: { SESSION_SECRET?: string; DB?: D1Database } } })?.runtime?.env;
        if (env?.SESSION_SECRET && env?.DB) {
          const cookieHeader = context.request.headers.get('cookie') ?? undefined;
          const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
          if (!session) {
            return context.redirect('/portal/login');
          }
          const owner = await getOwnerByEmail(env.DB, session.email);
          const phones = owner ? getPhonesArray(owner) : [];
          const hasName = !!(owner?.name?.trim());
          const hasAddress = !!(owner?.address?.trim());
          const hasPhones = phones.length > 0 && phones.some((p) => !!p?.trim());
          if (!hasName || !hasAddress || !hasPhones) {
            return context.redirect('/portal/profile?required=1');
          }
        }
      }
    }
  }

  const response = await next();

  // Skip middleware during static generation if headers are not available
  if (!response || typeof response.headers === 'undefined' || !(response.headers instanceof Headers)) {
    return response;
  }

  try {
    // Ensure HTML responses declare UTF-8 so special characters render correctly
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.startsWith('text/html') && !contentType.includes('charset=')) {
      response.headers.set('Content-Type', contentType.trimEnd() + '; charset=utf-8');
    }
  } catch (_) {}

  try {
    // Allow same-origin framing for /api/portal/file-view (sandboxed attachment viewer in portal iframes)
    const allowSameOriginFrame = pathname.startsWith('/api/portal/file-view');

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', allowSameOriginFrame ? 'SAMEORIGIN' : 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // HSTS - Only set for HTTPS (Cloudflare handles this, but good to have)
    if (context.url.protocol === 'https:') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Content Security Policy
    // form-action: StaticForms (contact form); script-src/frame-src: reCAPTCHA (optional)
    // frame-ancestors: 'self' so portal can embed file-view in iframes; use 'none' for all other routes
    const frameAncestors = allowSameOriginFrame ? "'self'" : "'none'";
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.google.com https://www.gstatic.com https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.staticforms.dev https://challenges.cloudflare.com https://cloudflareinsights.com https://www.google.com",
      "frame-src 'self' https://www.google.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://api.staticforms.dev",
      `frame-ancestors ${frameAncestors}`,
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
