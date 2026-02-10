/**
 * Client-Side Permission Helpers
 *
 * Optional utilities for checking permissions in the browser.
 * Used for showing/hiding UI elements based on permissions.
 *
 * Note: These are for UX only. Server-side guards enforce actual security.
 */

export type ClientPermissionLevel = 'none' | 'read' | 'write';

export interface ClientPermissionCache {
  role: string;
  permissions: Record<string, ClientPermissionLevel>;
  fetchedAt: number;
  expiresAt: number;
}

const CACHE_KEY = 'clrhoa_permissions';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch permissions for current user's role from API.
 *
 * @param role - User's role
 * @param forceRefresh - Force fetch even if cached
 * @returns Permission map or null if error
 */
export async function fetchPermissions(
  role: string,
  forceRefresh = false
): Promise<Record<string, ClientPermissionLevel> | null> {
  // Check cache first
  if (!forceRefresh) {
    const cached = getPermissionsFromCache();
    if (cached && cached.role === role && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }
  }

  try {
    const response = await fetch(`/api/permissions/for-role?role=${encodeURIComponent(role)}`);

    if (!response.ok) {
      console.error('Failed to fetch permissions:', response.status);
      return null;
    }

    const data = await response.json() as { permissions: Record<string, ClientPermissionLevel> };
    const permissions = data.permissions;

    // Cache the result
    cachePermissions(role, permissions);

    return permissions;
  } catch (err) {
    console.error('Error fetching permissions:', err);
    return null;
  }
}

/**
 * Get permissions from localStorage cache.
 */
function getPermissionsFromCache(): ClientPermissionCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as ClientPermissionCache;
    return data;
  } catch {
    return null;
  }
}

/**
 * Save permissions to localStorage cache.
 */
function cachePermissions(
  role: string,
  permissions: Record<string, ClientPermissionLevel>
): void {
  try {
    const now = Date.now();
    const cache: ClientPermissionCache = {
      role,
      permissions,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('Failed to cache permissions:', err);
  }
}

/**
 * Clear permissions cache.
 */
export function clearPermissionsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.warn('Failed to clear permissions cache:', err);
  }
}

/**
 * Check if user has permission for a specific path.
 *
 * @param role - User's role
 * @param path - Route path to check
 * @param requiredLevel - Required permission level (default: 'read')
 * @returns Promise<boolean> - True if has permission
 */
export async function hasClientPermission(
  role: string,
  path: string,
  requiredLevel: ClientPermissionLevel = 'read'
): Promise<boolean> {
  const permissions = await fetchPermissions(role);
  if (!permissions) return false;

  const userLevel = permissions[path] || 'none';
  const levelRank: Record<ClientPermissionLevel, number> = { none: 0, read: 1, write: 2 };

  return levelRank[userLevel] >= levelRank[requiredLevel];
}

/**
 * Initialize permission-based UI visibility.
 * Call this on page load to show/hide elements based on data-permission attributes.
 *
 * @param role - Current user's role
 *
 * @example HTML:
 * ```html
 * <button data-permission="write">Edit</button>
 * <button data-permission="write" data-permission-path="/board/meetings">Edit Meeting</button>
 * ```
 */
export async function initPermissionUI(role: string): Promise<void> {
  const permissions = await fetchPermissions(role);
  if (!permissions) return;

  const currentPath = window.location.pathname;

  // Find all elements with data-permission attribute
  const elements = document.querySelectorAll<HTMLElement>('[data-permission]');

  elements.forEach((el) => {
    const required = el.dataset.permission as ClientPermissionLevel;
    const targetPath = el.dataset.permissionPath || currentPath;

    const userLevel = permissions[targetPath] || 'none';
    const levelRank: Record<ClientPermissionLevel, number> = { none: 0, read: 1, write: 2 };

    const hasAccess = levelRank[userLevel] >= levelRank[required];

    if (!hasAccess) {
      // Hide element or disable it
      const hideMode = el.dataset.permissionHide || 'display'; // 'display', 'visibility', 'disable'

      if (hideMode === 'display') {
        el.style.display = 'none';
      } else if (hideMode === 'visibility') {
        el.style.visibility = 'hidden';
      } else if (hideMode === 'disable' && el instanceof HTMLButtonElement) {
        el.disabled = true;
        el.title = 'You do not have permission for this action';
      }
    }
  });
}

/**
 * Setup automatic permission refresh.
 * Re-fetches permissions every 15 minutes or when tab becomes visible.
 *
 * @param role - Current user's role
 * @param onUpdate - Optional callback when permissions update
 */
export function setupPermissionRefresh(
  role: string,
  onUpdate?: (permissions: Record<string, ClientPermissionLevel>) => void
): () => void {
  let intervalId: number | null = null;

  const refresh = async () => {
    const permissions = await fetchPermissions(role, true);
    if (permissions && onUpdate) {
      onUpdate(permissions);
    }
  };

  // Refresh every 15 minutes
  intervalId = window.setInterval(refresh, CACHE_TTL_MS);

  // Refresh when tab becomes visible
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      refresh();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return cleanup function
  return () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * Get permission level for current path.
 *
 * @param role - User's role
 * @param path - Route path (defaults to current path)
 * @returns Promise<ClientPermissionLevel> - Permission level
 */
export async function getPermissionLevel(
  role: string,
  path?: string
): Promise<ClientPermissionLevel> {
  const permissions = await fetchPermissions(role);
  if (!permissions) return 'none';

  const targetPath = path || window.location.pathname;
  return permissions[targetPath] || 'none';
}
