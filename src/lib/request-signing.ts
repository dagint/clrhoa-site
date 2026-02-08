/**
 * API request signing utilities for high-value operations.
 * Implements HMAC-based request signing with timestamp and nonce to prevent replay attacks.
 */

export interface SignedRequest {
  timestamp: number; // Unix timestamp in seconds
  nonce: string; // Random nonce to prevent replay
  signature: string; // HMAC signature
}

/**
 * Generate a random nonce.
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign a request with HMAC using the session secret.
 * Returns signed request data.
 */
export async function signRequest(
  method: string,
  path: string,
  body: string | null,
  timestamp: number,
  nonce: string,
  secret: string
): Promise<string> {
  // Create message to sign: method + path + timestamp + nonce + body hash
  const bodyHash = body ? await hashString(body) : '';
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  
  // Sign with HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return sigB64;
}

/**
 * Hash a string using SHA-256.
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a signed request payload for high-value operations.
 */
export async function createSignedRequest(
  method: string,
  path: string,
  body: Record<string, any> | null,
  secret: string
): Promise<SignedRequest> {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const bodyStr = body ? JSON.stringify(body) : null;
  const signature = await signRequest(method, path, bodyStr, timestamp, nonce, secret);
  
  return {
    timestamp,
    nonce,
    signature,
  };
}

/**
 * Verify a signed request.
 * Returns true if valid, false otherwise.
 */
export async function verifySignedRequest(
  method: string,
  path: string,
  body: string | null,
  signedRequest: SignedRequest,
  secret: string,
  maxAgeSeconds: number = 300 // 5 minutes default
): Promise<boolean> {
  // Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const age = now - signedRequest.timestamp;
  if (age < 0 || age > maxAgeSeconds) {
    return false; // Request too old or from the future
  }
  
  // Verify signature
  const expectedSignature = await signRequest(
    method,
    path,
    body,
    signedRequest.timestamp,
    signedRequest.nonce,
    secret
  );
  
  return expectedSignature === signedRequest.signature;
}

/**
 * Extract signed request data from request headers or body.
 */
export function extractSignedRequest(request: Request, body?: Record<string, any>): SignedRequest | null {
  // Try to get from headers first
  const timestamp = request.headers.get('x-request-timestamp');
  const nonce = request.headers.get('x-request-nonce');
  const signature = request.headers.get('x-request-signature');
  
  if (timestamp && nonce && signature) {
    return {
      timestamp: parseInt(timestamp, 10),
      nonce,
      signature,
    };
  }
  
  // Try to get from body
  if (body && typeof body.timestamp === 'number' && body.nonce && body.signature) {
    return {
      timestamp: body.timestamp,
      nonce: body.nonce,
      signature: body.signature,
    };
  }
  
  return null;
}
