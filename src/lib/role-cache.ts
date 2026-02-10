/**
 * Request-scoped role caching to reduce KV lookups.
 * Cache is stored in-memory for the duration of a single request.
 */

const roleCache = new Map<string, Map<string, string>>();

/**
 * Get a request-scoped role cache.
 * Uses correlation ID or creates a default cache for the request.
 *
 * @param requestId - Optional request correlation ID
 * @returns Map of email -> role
 */
export function getRoleCache(requestId: string = 'default'): Map<string, string> {
  if (!roleCache.has(requestId)) {
    roleCache.set(requestId, new Map());
  }
  return roleCache.get(requestId)!;
}

/**
 * Clear cache for a specific request (called at end of request lifecycle).
 * In serverless environments, this is less critical since each request
 * gets a fresh isolate, but helps in local dev and long-running instances.
 *
 * @param requestId - Optional request correlation ID
 */
export function clearRoleCache(requestId: string = 'default'): void {
  roleCache.delete(requestId);
}

/**
 * Clear all caches (useful for testing or memory management).
 */
export function clearAllRoleCaches(): void {
  roleCache.clear();
}
