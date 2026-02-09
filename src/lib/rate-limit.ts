/**
 * IP-based rate limiting utilities for API endpoints.
 * Uses Cloudflare KV store to track requests per IP address.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
}

/**
 * Check rate limit for an IP address on a specific endpoint.
 * Returns whether the request is allowed and remaining requests.
 */
export async function checkRateLimit(
  kv: KVNamespace | undefined,
  endpoint: string,
  ipAddress: string | null,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!kv || !ipAddress) {
    // If no KV or IP, allow the request (graceful degradation)
    return { allowed: true, remaining: maxRequests, resetAt: Math.floor(Date.now() / 1000) + windowSeconds };
  }

  const key = `rate_limit:${endpoint}:${ipAddress}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const windowKey = `${key}:${windowStart}`;

  // Get current count for this window
  const countStr = await kv.get(windowKey, { type: 'text' });
  const count = parseInt(countStr ?? '0', 10);

  if (count >= maxRequests) {
    // Rate limit exceeded
    const resetAt = windowStart + windowSeconds;
    return { allowed: false, remaining: 0, resetAt };
  }

  // Increment counter
  const newCount = count + 1;
  await kv.put(windowKey, newCount.toString(), { expirationTtl: windowSeconds + 60 }); // Add 60s buffer

  return {
    allowed: true,
    remaining: maxRequests - newCount,
    resetAt: windowStart + windowSeconds,
  };
}

/**
 * Rate limit configuration for different endpoints.
 */
export const RATE_LIMITS = {
  '/api/login': { maxRequests: 5, windowSeconds: 15 * 60 }, // 5 attempts per 15 minutes
  '/api/arb-upload': { maxRequests: 10, windowSeconds: 60 * 60 }, // 10 uploads per hour
  '/api/arb-approve': { maxRequests: 100, windowSeconds: 60 }, // 100 requests per minute
  '/api/arb-update': { maxRequests: 20, windowSeconds: 60 }, // 20 updates per minute
  '/api/arb-cancel': { maxRequests: 10, windowSeconds: 60 }, // 10 cancels per minute
  '/api/arb-remove-file': { maxRequests: 20, windowSeconds: 60 }, // 20 file removals per minute
  '/api/arb-resubmit': { maxRequests: 10, windowSeconds: 60 }, // 10 resubmits per minute
  '/api/arb-notes': { maxRequests: 30, windowSeconds: 60 }, // 30 note updates per minute
  '/api/arb-deadline': { maxRequests: 20, windowSeconds: 60 }, // 20 deadline updates per minute
  '/api/arb-add-files': { maxRequests: 10, windowSeconds: 60 * 60 }, // 10 file additions per hour
  '/api/arb-copy': { maxRequests: 10, windowSeconds: 60 }, // 10 copies per minute
  '/api/owners/upload-csv': { maxRequests: 10, windowSeconds: 60 * 60 }, // 10 uploads per hour per IP
  '/api/vendors/upload-csv': { maxRequests: 10, windowSeconds: 60 * 60 }, // 10 uploads per hour per IP
  '/api/log-phone-view': { maxRequests: 60, windowSeconds: 60 }, // 60 reveals (phone or email) per minute per IP
  '/api/site-feedback': { maxRequests: 3, windowSeconds: 86400 }, // 3 site feedback submissions per day per IP
  '/api/contact': { maxRequests: 10, windowSeconds: 60 * 60 }, // 10 contact form submissions per hour per IP
} as const;

/**
 * Get rate limit configuration for an endpoint.
 */
export function getRateLimitConfig(endpoint: string): { maxRequests: number; windowSeconds: number } | null {
  // Try exact match first
  if (endpoint in RATE_LIMITS) {
    return RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS];
  }

  // Try prefix match for API endpoints
  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    if (endpoint.startsWith(key)) {
      return config;
    }
  }

  // Default rate limit for unknown endpoints
  return { maxRequests: 100, windowSeconds: 60 };
}
