/**
 * Simple XOR encrypt for backup refresh token. Must match Worker decrypt (workers/backup/src/index.ts).
 * For production consider AES-GCM; this is minimal and works with Workers.
 */
export function encryptRefreshToken(plain: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const buf = new TextEncoder().encode(plain);
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i]! ^ keyBytes[i % keyBytes.length]!;
  let binary = '';
  for (let i = 0; i < out.length; i++) binary += String.fromCharCode(out[i]!);
  return btoa(binary);
}
