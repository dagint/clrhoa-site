/**
 * Astro Middleware: portal auth, board/elevated access, and security headers.
 * - /portal/* (except /portal/login): require session cookie or redirect to login; profile completeness redirect to /portal/profile?required=1.
 * - /board/*: require session (else redirect to login) and elevated role (else redirect to /portal/dashboard).
 * - Elevated API path prefixes: if session exists but role is not elevated, return 403 before the handler.
 * - Security headers on all responses.
 */

import type { MiddlewareHandler } from 'astro';
import { getSessionFromCookie, SESSION_COOKIE_NAME, isElevatedRole, getEffectiveRole } from './lib/auth';
import { getOwnerByEmail, getPhonesArray } from './lib/directory-db';

/** Admin accounts (e.g. service providers) are not required to have an address in the directory. */
function isProfileComplete(
  owner: Awaited<ReturnType<typeof getOwnerByEmail>>,
  phones: string[],
  effectiveRole: string
): boolean {
  const hasName = !!(owner?.name?.trim());
  const hasAddress = !!(owner?.address?.trim());
  const hasPhones = phones.length > 0 && phones.some((p) => !!p?.trim());
  if (effectiveRole === 'admin') return hasName && hasPhones;
  return hasName && hasAddress && hasPhones;
}

/** API path prefixes that require an elevated role (board, arb, admin, arb_board). Middleware returns 403 if session exists but role is not elevated. */
const ELEVATED_API_PREFIXES = [
  '/api/admin',
  '/api/board',
  '/api/owners',
  '/api/meetings',
  '/api/maintenance-update',
  '/api/public-document-upload',
  '/api/member-document',
  '/api/arb-approve',
  '/api/arb-notes',
  '/api/arb-deadline',
  '/api/arb-export',
];

export const onRequest: MiddlewareHandler = async (context, next) => {
  const pathname = context.url.pathname;
  // During static prerender, request.headers is not available; skip auth and pass through to avoid warnings
  const hasHeaders = typeof context.request?.headers?.get === 'function';
  if (!hasHeaders) {
    return await next();
  }
  const env = context.locals.runtime?.env;
  const cookieHeader = context.request.headers.get('cookie') ?? undefined;

  // Board admin: require session and effective elevated role (PIM: JIT elevation).
  // If not elevated, send to request-elevated-access landing so they can elevate and then return here.
  if (pathname.startsWith('/board')) {
    if (!context.cookies.has(SESSION_COOKIE_NAME)) {
      return context.redirect('/portal/login');
    }
    if (env?.SESSION_SECRET) {
      const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
      if (!session) {
        return context.redirect('/portal/login');
      }
      if (!isElevatedRole(getEffectiveRole(session))) {
        const returnUrl = encodeURIComponent(pathname);
        return context.redirect(`/portal/request-elevated-access?return=${returnUrl}`);
      }
    }
  }

  // Admin (e.g. /admin/feedback): same as board — session + effective elevated role
  if (pathname.startsWith('/admin')) {
    if (!context.cookies.has(SESSION_COOKIE_NAME)) {
      return context.redirect('/portal/login');
    }
    if (env?.SESSION_SECRET) {
      const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
      if (!session) {
        return context.redirect('/portal/login');
      }
      if (!isElevatedRole(getEffectiveRole(session))) {
        const returnUrl = encodeURIComponent(pathname);
        return context.redirect(`/portal/request-elevated-access?return=${returnUrl}`);
      }
    }
  }

  // Elevated APIs: 403 if session exists but effective role is not elevated
  // Exceptions (allow any logged-in user; handler enforces owner vs elevated):
  //   /api/owners/me — members update own directory info
  //   /api/arb-notes — members add owner_notes to their request; ARB/Board set internal notes
  const isOwnProfileApi = pathname === '/api/owners/me' || pathname.startsWith('/api/owners/me/');
  const isMemberArbNotesApi = pathname === '/api/arb-notes' || pathname.startsWith('/api/arb-notes/');
  if (env?.SESSION_SECRET && !isOwnProfileApi && !isMemberArbNotesApi && ELEVATED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (context.cookies.has(SESSION_COOKIE_NAME)) {
      const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
      if (session && !isElevatedRole(getEffectiveRole(session))) {
        return new Response(JSON.stringify({ error: 'Forbidden', success: false }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

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
        const env = context.locals.runtime?.env;
        if (env?.SESSION_SECRET && env?.DB) {
          const cookieHeader = context.request.headers.get('cookie') ?? undefined;
          const session = await getSessionFromCookie(cookieHeader, env.SESSION_SECRET);
          if (!session) {
            return context.redirect('/portal/login');
          }
          const owner = await getOwnerByEmail(env.DB, session.email);
          const phones = owner ? getPhonesArray(owner) : [];
          const effectiveRole = getEffectiveRole(session);
          const profileComplete = isProfileComplete(owner, phones, effectiveRole);
          if (!profileComplete) {
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
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.google.com https://www.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
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
