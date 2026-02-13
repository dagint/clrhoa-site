/**
 * Astro Middleware: portal auth, board/elevated access, and security headers.
 * - /portal/* (except /portal/login): require session cookie or redirect to login; profile completeness redirect to /portal/profile?required=1.
 * - /board (exact): public Board & Committees page; no redirect. /board/*: require session and elevated role.
 * - Elevated API path prefixes: if session exists but role is not elevated, return 403 before the handler.
 * - Security headers on all responses.
 */

import type { MiddlewareHandler } from 'astro';
import { getSessionFromCookie, isElevatedRole as isElevatedRoleLegacy, getEffectiveRole, isAdminRole as isAdminRoleLegacy } from './lib/auth';
import {
  validateSession,
  getSessionId,
  SESSION_COOKIE_NAME,
  isElevatedRole,
  isAdminRole,
  getRoleLandingZone,
} from './lib/auth/middleware';
import { getOwnerByEmail, getPhonesArray } from './lib/directory-db';
import { generateCorrelationId } from './lib/logging';
import { getUserEmail, getUserRole } from './types/auth';
import { hasRouteAccess, getAccessDeniedRedirect } from './utils/role-access';

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

  // Generate correlation ID for request tracing (check for existing one from upstream, e.g., Cloudflare)
  const existingCorrelationId = context.request.headers.get('X-Correlation-ID') ||
                                 context.request.headers.get('CF-Ray') ||
                                 null;
  const correlationId = existingCorrelationId || generateCorrelationId();

  // Store correlation ID in context.locals for access throughout the request
  // Note: context.locals is initialized by Astro with runtime property, so we just add correlationId
  context.locals.correlationId = correlationId;

  const env = context.locals.runtime?.env;
  const cookieHeader = context.request.headers.get('cookie') ?? undefined;

  // Auth routes (/auth/*): public routes for login, password reset, etc.
  // If already logged in, redirect to dashboard from login/setup/reset pages
  if (pathname.startsWith('/auth')) {
    const publicAuthRoutes = [
      '/auth/login',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/setup-password',
    ];

    const isPublicAuthRoute = publicAuthRoutes.some((route) =>
      pathname === route || pathname === `${route}/`
    );

    if (isPublicAuthRoute && context.cookies.has(SESSION_COOKIE_NAME) && env?.DB) {
      // User is already logged in, validate their session
      const sessionId = getSessionId(context);
      const { session, user } = await validateSession(env.DB, sessionId);

      if (session && user) {
        // Valid session - redirect to appropriate landing zone
        const userRole = getUserRole(user)?.toLowerCase() || 'member';
        return context.redirect(getRoleLandingZone(userRole));
      }
    }
  }

  // Board routes (/board/*): require session and role-based access.
  // Public /board (exact) is the public Board & Committees page — do not redirect.
  const isPublicBoardPage = pathname === '/board' || pathname === '/board/';
  if (!isPublicBoardPage && pathname.startsWith('/board')) {
    if (!context.cookies.has(SESSION_COOKIE_NAME)) {
      return context.redirect(`/auth/login?return=${encodeURIComponent(pathname)}`);
    }
    if (env?.DB) {
      const sessionId = getSessionId(context);
      const { session, user } = await validateSession(env.DB, sessionId);

      if (!session || !user) {
        return context.redirect(`/auth/login?return=${encodeURIComponent(pathname)}`);
      }

      const userRole = getUserRole(user)?.toLowerCase() || 'member';

      if (!isElevatedRole(userRole)) {
        return context.redirect(`/portal/request-elevated-access?return=${encodeURIComponent(pathname)}`);
      }

      // Check PIM elevation status
      const elevatedUntil = (session as any).elevated_until;
      const now = Date.now();
      if (!elevatedUntil || elevatedUntil < now) {
        // User has elevated role but no active elevation - require PIM elevation
        return context.redirect(`/portal/request-elevated-access?return=${encodeURIComponent(pathname)}`);
      }

      // Check role-based access using centralized logic
      if (!hasRouteAccess(userRole, pathname)) {
        return context.redirect(getAccessDeniedRedirect(userRole));
      }

      // Store user in context for use in pages
      context.locals.user = user;
      context.locals.session = session;
    }
  }

  // Admin routes (/admin/*): admin role only
  if (pathname.startsWith('/admin')) {
    if (!context.cookies.has(SESSION_COOKIE_NAME)) {
      return context.redirect(`/auth/login?return=${encodeURIComponent(pathname)}`);
    }
    if (env?.DB) {
      const sessionId = getSessionId(context);
      const { session, user } = await validateSession(env.DB, sessionId);

      if (!session || !user) {
        return context.redirect(`/auth/login?return=${encodeURIComponent(pathname)}`);
      }

      const userRole = getUserRole(user)?.toLowerCase() || 'member';

      if (!isAdminRole(userRole)) {
        return context.redirect(getRoleLandingZone(userRole));
      }

      // Check PIM elevation status
      const elevatedUntil = (session as any).elevated_until;
      const now = Date.now();
      if (!elevatedUntil || elevatedUntil < now) {
        // Admin needs active elevation - require PIM elevation
        return context.redirect(`/portal/request-elevated-access?return=${encodeURIComponent(pathname)}`);
      }

      // Store user in context for use in pages
      context.locals.user = user;
      context.locals.session = session;
    }
  }

  // Elevated APIs: 403 if session exists but role is not elevated
  // Exceptions (allow any logged-in user; handler enforces owner vs elevated):
  //   /api/owners/me — members update own directory info
  //   /api/arb-notes — members add owner_notes to their request; ARB/Board set internal notes
  const isOwnProfileApi = pathname === '/api/owners/me' || pathname.startsWith('/api/owners/me/');
  const isMemberArbNotesApi = pathname === '/api/arb-notes' || pathname.startsWith('/api/arb-notes/');

  if (env?.DB && !isOwnProfileApi && !isMemberArbNotesApi && ELEVATED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (context.cookies.has(SESSION_COOKIE_NAME)) {
      const sessionId = getSessionId(context);
      const { session, user } = await validateSession(env.DB, sessionId);

      if (session && user) {
        const userRole = getUserRole(user)?.toLowerCase() || 'member';

        if (!isElevatedRole(userRole)) {
          return new Response(JSON.stringify({ error: 'Forbidden', success: false }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check PIM elevation status
        const elevatedUntil = (session as any).elevated_until;
        const now = Date.now();
        if (!elevatedUntil || elevatedUntil < now) {
          // User has elevated role but no active elevation
          return new Response(JSON.stringify({ error: 'Forbidden: Elevation required', success: false }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Store user in context for API handlers
        context.locals.user = user;
        context.locals.session = session;
      }
    }
  }

  // Portal: require session for all routes except login (which redirects to /auth/login)
  if (pathname.startsWith('/portal')) {
    // Legacy /portal/login redirect to new /auth/login
    if (pathname === '/portal/login' || pathname === '/portal/login/') {
      return context.redirect('/auth/login');
    }

    // Protected portal route: no cookie => redirect to login
    if (!context.cookies.has(SESSION_COOKIE_NAME)) {
      return context.redirect(`/auth/login?return=${encodeURIComponent(pathname)}`);
    }

    // Validate Lucia session
    if (env?.DB) {
      const sessionId = getSessionId(context);
      const { session, user } = await validateSession(env.DB, sessionId);

      if (!session || !user) {
        // Invalid session - redirect to login
        return context.redirect(`/auth/login?return=${encodeURIComponent(pathname)}`);
      }

      // Get user role from Lucia user object
      const userRole = getUserRole(user)?.toLowerCase() || 'member';
      const isProfilePage = pathname === '/portal/profile' || pathname === '/portal/profile/';

      // Role-based landing zones and admin-only routes
      if (pathname === '/portal/admin' || pathname === '/portal/admin/' || pathname.startsWith('/portal/admin/')) {
        if (!isAdminRole(userRole)) {
          return context.redirect(getRoleLandingZone(userRole));
        }
        // Check PIM elevation for admin
        const elevatedUntil = (session as any).elevated_until;
        const now = Date.now();
        if (!elevatedUntil || elevatedUntil < now) {
          return context.redirect(`/portal/request-elevated-access?return=${encodeURIComponent(pathname)}`);
        }
      } else if (pathname === '/portal/board' || pathname === '/portal/board/') {
        if (userRole !== 'board' && userRole !== 'arb_board') {
          return context.redirect(getRoleLandingZone(userRole));
        }
        // Check PIM elevation for board
        const elevatedUntil = (session as any).elevated_until;
        const now = Date.now();
        if (!elevatedUntil || elevatedUntil < now) {
          return context.redirect(`/portal/request-elevated-access?return=${encodeURIComponent(pathname)}`);
        }
      } else if (pathname === '/portal/arb' || pathname === '/portal/arb/') {
        if (userRole !== 'arb' && userRole !== 'arb_board') {
          return context.redirect(getRoleLandingZone(userRole));
        }
        // Check PIM elevation for ARB
        const elevatedUntil = (session as any).elevated_until;
        const now = Date.now();
        if (!elevatedUntil || elevatedUntil < now) {
          return context.redirect(`/portal/request-elevated-access?return=${encodeURIComponent(pathname)}`);
        }
      } else if ((pathname === '/portal/usage' || pathname.startsWith('/portal/usage')) && !pathname.startsWith('/portal/admin/')) {
        if (!isAdminRole(userRole)) {
          return context.redirect(getRoleLandingZone(userRole));
        }
        // Check PIM elevation for usage
        const elevatedUntil = (session as any).elevated_until;
        const now = Date.now();
        if (!elevatedUntil || elevatedUntil < now) {
          return context.redirect(`/portal/request-elevated-access?return=${encodeURIComponent(pathname)}`);
        }
      }

      // Profile completeness check (avoids "response already sent" when component would redirect)
      if (!isProfilePage) {
        const userEmail = getUserEmail(user);
        if (!userEmail) {
          return context.redirect('/auth/login');
        }
        const owner = await getOwnerByEmail(env.DB, userEmail);
        const phones = owner ? getPhonesArray(owner) : [];
        const profileComplete = isProfileComplete(owner, phones, userRole);
        if (!profileComplete) {
          return context.redirect('/portal/profile?required=1');
        }
      }

      // Store user in context.locals for use in pages
      context.locals.user = user;
      context.locals.session = session;
    }
  }

  const response = await next();

  // Skip middleware during static generation if headers are not available
  if (!response || typeof response.headers === 'undefined' || !(response.headers instanceof Headers)) {
    return response;
  }

  // Add correlation ID to response headers for client-side tracing
  try {
    if (correlationId) {
      response.headers.set('X-Correlation-ID', correlationId);
    }
  } catch (_) {
    // Non-fatal: correlation ID header is optional
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
