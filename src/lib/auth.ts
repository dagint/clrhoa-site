/**
 * Portal auth: session cookie (signed), KV whitelist check, helpers.
 * Session: HttpOnly, Secure, SameSite=Lax, signed payload.
 */
/// <reference types="@cloudflare/workers-types" />

export const SESSION_COOKIE_NAME = 'clrhoa_session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  email: string;
  role: string;
  name: string | null;
  exp: number;
  csrfToken?: string;
  lastActivity?: number;
  sessionId?: string; // Unique session identifier
  fingerprint?: string; // Browser + IP fingerprint hash
  createdAt?: number; // Session creation timestamp
  /** PIM: Unix ms when elevated access expires. When set and > now, effective role is session.role; else effective = 'member' for elevated whitelist roles. */
  elevated_until?: number;
  /** Admin and arb_board: temporarily act as Board or ARB (not both). When set, getEffectiveRole returns this. Logged and auditable. */
  assumed_role?: 'board' | 'arb';
  /** When assumed_role was set (Unix ms). Used for display and audit. */
  assumed_at?: number;
  /** When assumed role expires (Unix ms). After this, user falls back to admin or arb_board until they assume again or drop. */
  assumed_until?: number;
}

export interface EnvWithAuth {
  CLOURHOA_USERS?: KVNamespace;
  SESSION_SECRET?: string;
  KV?: KVNamespace; // For rate limiting and lockout tracking
}

/**
 * Check if email is on the whitelist (KV). Key = lowercase email, value = "1" or role.
 */
export async function isEmailWhitelisted(
  kv: KVNamespace | undefined,
  email: string
): Promise<boolean> {
  if (!kv) return false;
  const key = email.trim().toLowerCase();
  const value = await kv.get(key);
  return value !== null && value !== undefined;
}

/** Elevated roles (ARB, Board, both, or Admin). */
export const ELEVATED_ROLES = new Set<string>(['arb', 'board', 'arb_board', 'admin']);
export const VALID_ROLES = new Set<string>(['member', 'arb', 'board', 'arb_board', 'admin']);

/** PIM: 2-hour window for JIT elevated access. */
export const PIM_ELEVATION_TTL_MS = 2 * 60 * 60 * 1000;

export function isElevatedRole(role: string): boolean {
  return ELEVATED_ROLES.has(role.toLowerCase());
}

/**
 * True only for effective role 'board'. arb_board must elevate to Board to record payments;
 * admin must assume Board. Ensures one-role-at-a-time for arb_board.
 */
export function canRecordPayments(role: string): boolean {
  const r = role?.toLowerCase();
  return r === 'board';
}

/**
 * True for effective role 'arb' or 'arb_board' only. Board and admin have view-only access
 * to the ARB dashboard; only ARB (or ARB+Board when acting as ARB) can approve, reject,
 * set deadlines, or add ARB notes.
 */
export function canApproveArb(role: string): boolean {
  const r = role?.toLowerCase();
  return r === 'arb' || r === 'arb_board';
}

/**
 * True for board, arb, or arb_board (not admin). Use for directory CRUD, directory export/CSV,
 * and any other operation that should be restricted from admin while allowing browse access.
 */
export function isBoardOrArbOnly(role: string): boolean {
  const r = role?.toLowerCase();
  return r === 'board' || r === 'arb' || r === 'arb_board';
}

/**
 * True only for effective role 'board' (not arb, not arb_board unless they assumed Board).
 * Use for Board-only operations: feedback management, meetings, maintenance, vendors.
 * Ensures arb_board must explicitly assume Board role to perform Board actions.
 */
export function isBoardOnly(role: string): boolean {
  const r = role?.toLowerCase();
  return r === 'board';
}

/**
 * True only for effective role 'admin'. Use for admin-only routes: site feedback,
 * SMS requests, test email, site usage, audit logs. Ensures clear separation from Board/ARB.
 */
export function isAdminRole(role: string): boolean {
  const r = role?.toLowerCase();
  return r === 'admin';
}

/**
 * True for effective role 'arb' (or arb_board when acting as ARB). Use for ARB-only landing and routes.
 */
export function isArbRole(role: string): boolean {
  const r = role?.toLowerCase();
  return r === 'arb';
}

/**
 * Effective role for access control (PIM/JIT). If user has an elevated whitelist role but
 * elevated_until is missing or expired, they see member access until they request elevation.
 * For admin and arb_board: if assumed_role is set and not expired, returns that role (board or arb)
 * so they act in one capacity at a time; otherwise returns session role (admin or arb_board).
 */
export function getEffectiveRole(session: SessionPayload | null): string {
  if (!session) return 'member';
  const role = session.role?.toLowerCase() ?? 'member';
  if (!ELEVATED_ROLES.has(role)) return session.role ?? 'member';
  const until = session.elevated_until;
  if (until == null || until < Date.now()) return 'member';
  // Admin and arb_board: act as Board or ARB only when explicitly elevated; one at a time; timeout clears it.
  if (role === 'admin' || role === 'arb_board') {
    const assumed = session.assumed_role;
    const assumedUntil = session.assumed_until;
    if (assumed && (assumedUntil == null || assumedUntil > Date.now())) return assumed;
  }
  return session.role ?? 'member';
}

/**
 * Set an email's role on the login whitelist (KV). Value is "1" for member or JSON { role } for elevated.
 * Use when adding/editing an owner in board directory with a role selection.
 */
export async function setLoginWhitelistRole(
  kv: KVNamespace | undefined,
  email: string,
  role: string
): Promise<void> {
  if (!kv || !email?.trim()) return;
  const key = email.trim().toLowerCase();
  const r = role?.trim().toLowerCase() || 'member';
  const value = r === 'member' ? '1' : JSON.stringify({ role: r });
  await kv.put(key, value);
}

/**
 * Add an email to the login whitelist (KV) as a member only if not already present.
 * Used when adding a new owner to the directory so they can sign in without manual KV setup.
 * Does not overwrite existing entries (e.g. admin/board/arb).
 */
export async function addToLoginWhitelistIfMissing(
  kv: KVNamespace | undefined,
  email: string
): Promise<void> {
  if (!kv || !email?.trim()) return;
  const key = email.trim().toLowerCase();
  const existing = await kv.get(key);
  if (existing !== null && existing !== undefined) return; // already on whitelist; do not overwrite role
  await kv.put(key, '1'); // member
}

/**
 * Remove an email from the login whitelist (KV) when they are removed from the directory.
 * Skips removal if the KV entry has role "admin" so admins can still log in without being in the directory.
 */
export async function removeFromLoginWhitelistUnlessAdmin(
  kv: KVNamespace | undefined,
  email: string
): Promise<void> {
  if (!kv || !email?.trim()) return;
  const key = email.trim().toLowerCase();
  const value = await kv.get(key);
  if (value == null) return;
  try {
    const data = JSON.parse(value) as { role?: string };
    const role = typeof data.role === 'string' ? data.role.toLowerCase() : 'member';
    if (role === 'admin') return; // do not remove; admin is exception
  } catch {
    // plain "1" or other format: treat as member, allow removal
  }
  await kv.delete(key);
}

/**
 * Get optional role from KV for whitelist entry (e.g. "admin"). Default "member".
 */
export async function getWhitelistRole(
  kv: KVNamespace | undefined,
  email: string
): Promise<string> {
  if (!kv) return 'member';
  const key = email.trim().toLowerCase();
  const value = await kv.get(key);
  if (value === null || value === undefined) return 'member';
  try {
    const data = JSON.parse(value) as { role?: string };
    return typeof data.role === 'string' ? data.role : 'member';
  } catch {
    return 'member';
  }
}

/** Role labels suitable for directory display (board, admin, arb, arb_board). */
const DISPLAY_ROLES = new Set<string>(['board', 'admin', 'arb', 'arb_board']);

/**
 * Get roles for a list of emails from KV. Returns only board/admin/arb (not member).
 * Use for directory display so members can see who holds HOA roles. Safe: no secrets exposed.
 */
export async function getRolesForEmails(
  kv: KVNamespace | undefined,
  emails: (string | null | undefined)[],
  options: { useCache?: boolean; cacheKey?: string } = {}
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!kv) return out;

  const { useCache = true, cacheKey = 'default' } = options;
  const unique = [...new Set(emails.filter((e): e is string => Boolean(e?.trim())).map((e) => e!.trim().toLowerCase()))];

  // Import cache utilities dynamically to avoid circular dependencies
  let cache: Map<string, string> | undefined;
  if (useCache) {
    try {
      const { getRoleCache } = await import('./role-cache.js');
      cache = getRoleCache(cacheKey);
    } catch {
      // Cache not available, continue without it
    }
  }

  // Separate cached and uncached emails
  const uncached: string[] = [];
  for (const email of unique) {
    if (cache?.has(email)) {
      const role = cache.get(email)!;
      if (DISPLAY_ROLES.has(role)) {
        out.set(email, role);
      }
    } else {
      uncached.push(email);
    }
  }

  // Fetch uncached roles from KV
  if (uncached.length > 0) {
    await Promise.all(
      uncached.map(async (email) => {
        const value = await kv.get(email);
        if (value == null) return;
        try {
          const data = JSON.parse(value) as { role?: string };
          const role = typeof data.role === 'string' ? data.role.toLowerCase() : 'member';
          if (DISPLAY_ROLES.has(role)) {
            out.set(email, role);
            cache?.set(email, role); // Cache for subsequent calls
          }
        } catch {
          // ignore
        }
      })
    );
  }

  return out;
}

/**
 * Sign payload with HMAC-SHA256 using SESSION_SECRET. Returns base64url(payload).base64url(sig).
 */
async function signPayload(payload: SessionPayload, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const payloadB64 = btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payloadB64}.${sigB64}`;
}

/**
 * Generate a CSRF token.
 */
function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a session fingerprint from browser and IP information using SHA-256.
 * This helps detect session hijacking attempts.
 * Uses crypto.subtle.digest for cryptographically secure hashing.
 */
export async function generateSessionFingerprint(
  userAgent: string | null,
  ipAddress: string | null
): Promise<string> {
  const data = `${userAgent || 'unknown'}|${ipAddress || 'unknown'}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Use SHA-256 for cryptographically secure hashing
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Verify session fingerprint matches current request.
 */
export async function verifySessionFingerprint(
  sessionFingerprint: string | undefined,
  userAgent: string | null,
  ipAddress: string | null
): Promise<boolean> {
  if (!sessionFingerprint) return true; // Allow legacy sessions without fingerprint
  const currentFingerprint = await generateSessionFingerprint(userAgent, ipAddress);
  return sessionFingerprint === currentFingerprint;
}

/**
 * Verify and decode session cookie. Returns null if invalid or expired.
 * Also checks session timeout (30 minutes of inactivity) and fingerprint.
 */
export async function getSessionFromCookie(
  cookieHeader: string | undefined,
  secret: string | undefined,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<SessionPayload | null> {
  if (!secret || !cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  const [payloadB64, sigB64] = raw.split('.');
  if (!payloadB64 || !sigB64) return null;

  try {
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000)
      return null;

    // Check session timeout (30 minutes of inactivity)
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    if (payload.lastActivity && Date.now() - payload.lastActivity * 1000 > SESSION_TIMEOUT_MS) {
      return null; // Session expired due to inactivity
    }

    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadJson);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sig = Uint8Array.from(
      atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );
    const ok = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!ok) return null;

    // Verify session fingerprint
    if (userAgent !== undefined && ipAddress !== undefined) {
      if (payload.fingerprint) {
        // Fingerprint exists - verify it
        if (!(await verifySessionFingerprint(payload.fingerprint, userAgent, ipAddress))) {
          // Fingerprint mismatch - possible session hijacking
          console.warn('[auth] Session fingerprint mismatch', {
            email: payload.email,
            sessionId: payload.sessionId,
          });
          return null;
        }
      } else {
        // Legacy session without fingerprint
        // DEPRECATION: Sessions without fingerprints will be rejected after 2026-05-10
        const FINGERPRINT_DEPRECATION_DATE = new Date('2026-05-10T00:00:00Z').getTime();
        const now = Date.now();

        if (now >= FINGERPRINT_DEPRECATION_DATE) {
          // Deprecation period ended - reject legacy sessions
          console.warn('[auth] Legacy session rejected (no fingerprint)', {
            email: payload.email,
            sessionId: payload.sessionId,
          });
          return null;
        } else {
          // Still in grace period - allow but log
          console.warn('[auth] Legacy session allowed (no fingerprint) - will be rejected after 2026-05-10', {
            email: payload.email,
            sessionId: payload.sessionId,
            daysRemaining: Math.ceil((FINGERPRINT_DEPRECATION_DATE - now) / (1000 * 60 * 60 * 24)),
          });
        }
      }
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Update session with new activity timestamp and optionally refresh CSRF token.
 */
export async function updateSessionActivity(
  cookieHeader: string | undefined,
  secret: string | undefined,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<string | null> {
  const session = await getSessionFromCookie(cookieHeader, secret, userAgent, ipAddress);
  if (!session) return null;

  const updated: SessionPayload = {
    ...session,
    lastActivity: Math.floor(Date.now() / 1000),
    csrfToken: session.csrfToken || generateCsrfToken(),
  };

  return signPayload(updated, secret!);
}

/**
 * Re-issue session cookie with elevated_until set or cleared (PIM). Caller must set the cookie on response.
 */
export async function createSessionWithElevation(
  cookieHeader: string | undefined,
  secret: string | undefined,
  elevated_until: number | null,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<string | null> {
  const session = await getSessionFromCookie(cookieHeader, secret, userAgent, ipAddress);
  if (!session) return null;

  const updated: SessionPayload = {
    ...session,
    lastActivity: Math.floor(Date.now() / 1000),
    elevated_until: elevated_until ?? undefined,
  };
  if (elevated_until == null) delete (updated as unknown as Record<string, unknown>).elevated_until;

  return signPayload(updated, secret!);
}

/** Allowed assumed roles (admin and arb_board use these; one at a time). */
export const ASSUMED_ROLES = ['board', 'arb'] as const;
export type AdminAssumedRole = (typeof ASSUMED_ROLES)[number];

/** TTL for assumed role (2 hours). After this, user falls back to admin/arb_board until they assume again or drop. */
export const ASSUMED_ROLE_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Re-issue session cookie with assumed_role set or cleared (admin or arb_board only). Caller must set the cookie on response and log the action.
 * When setting a role, assumed_until is set so it auto-expires; user must drop or wait before assuming the other role.
 */
export async function createSessionWithAssumedRole(
  cookieHeader: string | undefined,
  secret: string | undefined,
  assumed_role: AdminAssumedRole | null,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<string | null> {
  const session = await getSessionFromCookie(cookieHeader, secret, userAgent, ipAddress);
  if (!session) return null;
  const r = session.role?.toLowerCase();
  if (r !== 'admin' && r !== 'arb_board') return null;

  const now = Date.now();
  const updated: SessionPayload = {
    ...session,
    lastActivity: Math.floor(now / 1000),
    assumed_role: assumed_role ?? undefined,
    assumed_at: assumed_role ? now : undefined,
    assumed_until: assumed_role ? now + ASSUMED_ROLE_TTL_MS : undefined,
  };
  if (assumed_role == null) {
    delete (updated as unknown as Record<string, unknown>).assumed_role;
    delete (updated as unknown as Record<string, unknown>).assumed_at;
    delete (updated as unknown as Record<string, unknown>).assumed_until;
  }

  return signPayload(updated, secret!);
}

/** True if the current effective role is due to admin or arb_board assuming Board or ARB (for audit logging). */
export function isAdminActingAs(session: SessionPayload | null): boolean {
  const r = session?.role?.toLowerCase();
  return (r === 'admin' || r === 'arb_board') && Boolean(session?.assumed_role);
}

/**
 * Build session payload and signed cookie value.
 */
export async function createSessionCookieValue(
  payload: Omit<SessionPayload, 'exp' | 'csrfToken' | 'lastActivity' | 'sessionId' | 'fingerprint' | 'createdAt'>,
  secret: string,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fingerprint = await generateSessionFingerprint(userAgent || null, ipAddress || null);
  const full: SessionPayload = {
    ...payload,
    exp: now + SESSION_MAX_AGE_SEC,
    csrfToken: generateCsrfToken(),
    lastActivity: now,
    sessionId: generateSessionId(),
    fingerprint,
    createdAt: now,
  };
  return signPayload(full, secret);
}

/**
 * Verify CSRF token from request header or body against session.
 */
export function verifyCsrfToken(
  session: SessionPayload | null,
  token: string | null | undefined
): boolean {
  if (!session || !token) return false;
  return session.csrfToken === token;
}

/**
 * Verify origin header to prevent CSRF attacks.
 */
export function verifyOrigin(
  origin: string | null,
  referer: string | null,
  expectedOrigin: string
): boolean {
  if (!origin && !referer) return false;

  // Check Origin header first (more reliable)
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedUrl = new URL(expectedOrigin);
      return originUrl.origin === expectedUrl.origin;
    } catch {
      return false;
    }
  }

  // Fallback to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const expectedUrl = new URL(expectedOrigin);
      return refererUrl.origin === expectedUrl.origin;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Check if account is locked due to failed login attempts.
 * Returns lockout expiry timestamp (seconds) if locked, null if not locked.
 */
export async function checkAccountLockout(
  kv: KVNamespace | undefined,
  email: string
): Promise<number | null> {
  if (!kv) return null;
  const key = `login_lockout:${email.toLowerCase()}`;
  const lockoutUntil = await kv.get(key, { type: 'text' });
  if (!lockoutUntil) return null;
  const expiry = parseInt(lockoutUntil, 10);
  if (expiry > Date.now() / 1000) {
    return expiry;
  }
  // Lockout expired, clean up
  await kv.delete(key);
  return null;
}

/**
 * Record a failed login attempt and lock account if threshold exceeded.
 * Returns true if account is now locked, false otherwise.
 */
export async function recordFailedLoginAttempt(
  kv: KVNamespace | undefined,
  email: string,
  ipAddress: string | null
): Promise<{ locked: boolean; attemptsRemaining: number; lockoutUntil?: number }> {
  if (!kv) {
    return { locked: false, attemptsRemaining: 5 };
  }

  const normalizedEmail = email.toLowerCase();
  const attemptKey = `login_attempts:${normalizedEmail}`;
  const lockoutKey = `login_lockout:${normalizedEmail}`;
  const ipKey = `login_ip:${normalizedEmail}`;

  // Check if already locked
  const lockoutUntil = await checkAccountLockout(kv, normalizedEmail);
  if (lockoutUntil) {
    return { locked: true, attemptsRemaining: 0, lockoutUntil };
  }

  // Get current attempt count
  const attemptsStr = await kv.get(attemptKey, { type: 'text' });
  const attempts = parseInt(attemptsStr ?? '0', 10);
  const newAttempts = attempts + 1;

  // Store IP address for security tracking
  if (ipAddress) {
    await kv.put(ipKey, ipAddress, { expirationTtl: 3600 }); // 1 hour
  }

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_SEC = 15 * 60; // 15 minutes

  if (newAttempts >= MAX_ATTEMPTS) {
    // Lock account
    const lockoutExpiry = Math.floor(Date.now() / 1000) + LOCKOUT_DURATION_SEC;
    await kv.put(lockoutKey, lockoutExpiry.toString(), { expirationTtl: LOCKOUT_DURATION_SEC });
    await kv.delete(attemptKey); // Clear attempts counter
    return { locked: true, attemptsRemaining: 0, lockoutUntil: lockoutExpiry };
  } else {
    // Increment attempts counter (expires after 1 hour)
    await kv.put(attemptKey, newAttempts.toString(), { expirationTtl: 3600 });
    return { locked: false, attemptsRemaining: MAX_ATTEMPTS - newAttempts };
  }
}

/**
 * Clear failed login attempts on successful login.
 */
export async function clearFailedLoginAttempts(
  kv: KVNamespace | undefined,
  email: string
): Promise<void> {
  if (!kv) return;
  const normalizedEmail = email.toLowerCase();
  await kv.delete(`login_attempts:${normalizedEmail}`);
  await kv.delete(`login_lockout:${normalizedEmail}`);
}
