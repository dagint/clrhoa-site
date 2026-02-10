/**
 * Service Worker for CLR HOA Portal
 * Implements offline caching strategy for improved UX and offline support.
 */

const CACHE_NAME = 'clrhoa-portal-v1';
const STATIC_CACHE_NAME = 'clrhoa-static-v1';
const API_CACHE_NAME = 'clrhoa-api-v1';

// Static assets to cache on install (CSS, JS, fonts, images)
const STATIC_ASSETS = [
  '/favicon.svg',
  '/icons/192.png',
  '/icons/512.png',
  '/manifest.json',
];

// Cache strategies
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i,
  /\/icons\//,
  /\/hero\//,
  /\/images\//,
];

const NETWORK_FIRST_PATTERNS = [
  /^\/api\//,
  /^\/portal\//,
  /^\/board\//,
  /^\/admin\//,
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
      });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name !== CACHE_NAME &&
              name !== STATIC_CACHE_NAME &&
              name !== API_CACHE_NAME &&
              name.startsWith('clrhoa-')
            );
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Fetch: Implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip service worker and manifest requests
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') {
    return;
  }

  // Cache-first for static assets
  if (CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for API and portal pages (need fresh data)
  if (NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default: Network-first with cache fallback
  event.respondWith(networkFirst(request, CACHE_NAME));
});

/**
 * Cache-first strategy: Check cache, fallback to network.
 * Best for static assets that don't change often.
 */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return a basic offline response if available
    if (request.destination === 'image') {
      return new Response('', { status: 408, statusText: 'Offline' });
    }
    throw error;
  }
}

/**
 * Network-first strategy: Try network, fallback to cache.
 * Best for dynamic content that needs to be fresh but should work offline.
 */
async function networkFirst(request, cacheName = CACHE_NAME) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // Cache successful responses (but not errors)
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    // If it's a navigation request and we have no cache, return offline page
    if (request.mode === 'navigate') {
      return new Response(
        `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline - CLR HOA Portal</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f9fafb;
                color: #111827;
              }
              .container {
                text-align: center;
                padding: 2rem;
                max-width: 400px;
              }
              h1 { color: #1e5f38; margin-bottom: 1rem; }
              p { color: #6b7280; margin-bottom: 1.5rem; }
              button {
                background: #1e5f38;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                font-size: 1rem;
                cursor: pointer;
              }
              button:hover { background: #2d8a5e; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>You're Offline</h1>
              <p>This page isn't available offline. Please check your connection and try again.</p>
              <button onclick="window.location.reload()">Retry</button>
            </div>
          </body>
        </html>
        `,
        {
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }
    throw error;
  }
}
