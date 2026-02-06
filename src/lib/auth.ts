/**
 * Portal auth: session cookie (signed), KV whitelist check, helpers.
 * Session: HttpOnly, Secure, SameSite=Lax, signed payload.
 */

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
 * Generate a session fingerprint from browser and IP information.
 * This helps detect session hijacking attempts.
 */
export function generateSessionFingerprint(
  userAgent: string | null,
  ipAddress: string | null
): string {
  const data = `${userAgent || 'unknown'}|${ipAddress || 'unknown'}`;
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Verify session fingerprint matches current request.
 */
export function verifySessionFingerprint(
  sessionFingerprint: string | undefined,
  userAgent: string | null,
  ipAddress: string | null
): boolean {
  if (!sessionFingerprint) return true; // Allow legacy sessions without fingerprint
  const currentFingerprint = generateSessionFingerprint(userAgent, ipAddress);
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
    
    // Verify session fingerprint (if present)
    if (payload.fingerprint && userAgent !== undefined && ipAddress !== undefined) {
      if (!verifySessionFingerprint(payload.fingerprint, userAgent, ipAddress)) {
        // Fingerprint mismatch - possible session hijacking
        return null;
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
 * Build session payload and signed cookie value.
 */
export async function createSessionCookieValue(
  payload: Omit<SessionPayload, 'exp' | 'csrfToken' | 'lastActivity' | 'sessionId' | 'fingerprint' | 'createdAt'>,
  secret: string,
  userAgent?: string | null,
  ipAddress?: string | null
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = {
    ...payload,
    exp: now + SESSION_MAX_AGE_SEC,
    csrfToken: generateCsrfToken(),
    lastActivity: now,
    sessionId: generateSessionId(),
    fingerprint: generateSessionFingerprint(userAgent || null, ipAddress || null),
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
