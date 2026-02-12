/**
 * Backup Worker: runs on cron. Exports D1 via Cloudflare API, dumps KV whitelist, uploads to R2.
 * Phase 3: reads backup_config from D1 and uploads same set to Google Drive when configured.
 */

const CF_API = "https://api.cloudflare.com/client/v4";

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_BACKUP_API_TOKEN: string;
  D1_DATABASE_ID: string;
  BACKUP_RETENTION_DAYS: string;
  CLOURHOA_USERS: KVNamespace;
  BACKUP_R2: R2Bucket;
  DB?: D1Database; // Phase 3: read backup_config
}

interface ExportResult {
  at_bookmark?: string;
  current_bookmark?: string;
  status?: string;
  result?: { signed_url?: string; filename?: string };
  error?: string;
  success?: boolean;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      await runBackup(env, date);
      // Retention only after backup succeeds: remove oldest so we never delete before a successful write
      await applyRetention(env);
      await recordLastBackupTime(env);
      // Phase 3: if backup_config has Google Drive enabled and schedule matches, upload to Drive
      await maybeUploadToGoogleDrive(env, date);
      // Cleanup old data after backup completes (contact submissions, old logs, etc.)
      await cleanupOldData(env);
    } catch (err) {
      console.error("Backup failed:", err);
      throw err;
    }
  },

  // Optional: allow triggering backup via HTTP (e.g. from portal with secret)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/trigger" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    const auth = request.headers.get("Authorization");
    const secret = (env as unknown as { BACKUP_TRIGGER_SECRET?: string }).BACKUP_TRIGGER_SECRET;
    if (secret && auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const date = new Date().toISOString().slice(0, 10);
    try {
      await runBackup(env, date);
      // Retention only after backup succeeds
      await applyRetention(env);
      await recordLastBackupTime(env);
      await maybeUploadToGoogleDrive(env, date);
      await cleanupOldData(env);
      return new Response(JSON.stringify({ ok: true, date }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

async function runBackup(env: Env, date: string): Promise<void> {
  // 1. Backup D1 database (SQL dump)
  const sql = await exportD1(env);
  const gzip = await gzipBuffer(new TextEncoder().encode(sql));
  const d1Key = `backups/d1/${date}.sql.gz`;
  await env.BACKUP_R2.put(d1Key, gzip, {
    httpMetadata: { contentType: "application/gzip" },
    customMetadata: { source: "d1", date },
  });

  // 2. Backup KV whitelist (JSON dump)
  const whitelist = await dumpWhitelistKV(env.CLOURHOA_USERS);
  const kvKey = `backups/kv/whitelist-${date}.json`;
  await env.BACKUP_R2.put(kvKey, JSON.stringify(whitelist, null, 2), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { source: "kv", date },
  });

  // 3. Backup R2 files (copy all non-backup files to backup location)
  const manifest = await backupR2Files(env, date);
  const manifestKey = `backups/r2/${date}/manifest.json`;
  await env.BACKUP_R2.put(manifestKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { source: "r2-manifest", date },
  });
}

async function exportD1(env: Env): Promise<string> {
  const base = `${CF_API}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}/export`;
  const headers = {
    Authorization: `Bearer ${env.CLOUDFLARE_BACKUP_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  // Start export
  let res = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ output_format: "polling" }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`D1 export start failed: ${res.status} ${t}`);
  }
  const start = (await res.json()) as { result?: ExportResult; success?: boolean };
  if (!start.success || !start.result) {
    throw new Error(`D1 export start invalid: ${JSON.stringify(start)}`);
  }

  // Check if already complete (small databases complete immediately)
  if (start.result.status === "complete" && start.result.result?.signed_url) {
    const sqlRes = await fetch(start.result.result.signed_url);
    if (!sqlRes.ok) throw new Error(`D1 export fetch SQL failed: ${sqlRes.status}`);
    return await sqlRes.text();
  }

  if (!start.result.at_bookmark) {
    throw new Error(`D1 export missing bookmark: ${JSON.stringify(start)}`);
  }
  let bookmark = start.result.at_bookmark;

  // Poll until complete (max ~5 min)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    res = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({ current_bookmark: bookmark }),
    });
    if (!res.ok) throw new Error(`D1 export poll failed: ${res.status}`);
    const poll = (await res.json()) as { result?: ExportResult; success?: boolean };
    if (!poll.success || !poll.result) throw new Error(`D1 export poll invalid: ${JSON.stringify(poll)}`);
    const r = poll.result;
    if (r.error) throw new Error(`D1 export error: ${r.error}`);
    if (r.result?.signed_url && r.status === "complete") {
      const sqlRes = await fetch(r.result.signed_url);
      if (!sqlRes.ok) throw new Error(`D1 export fetch SQL failed: ${sqlRes.status}`);
      return await sqlRes.text();
    }
    if (r.current_bookmark) bookmark = r.current_bookmark;
  }
  throw new Error("D1 export timed out");
}

async function gzipBuffer(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

async function dumpWhitelistKV(kv: KVNamespace): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let cursor: string | undefined;
  do {
    const list = await kv.list({ limit: 1000, cursor });
    for (const k of list.keys) {
      const v = await kv.get(k.name);
      if (v != null) out[k.name] = v;
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return out;
}

/**
 * Backup all R2 files (except backups/) to backups/r2/{date}/ and return manifest.
 * Uses server-side copy (no bandwidth costs) and handles pagination.
 */
async function backupR2Files(env: Env, date: string): Promise<{
  date: string;
  total_files: number;
  total_bytes: number;
  files: Array<{ key: string; size: number; uploaded: string; etag: string; backup_key: string }>;
}> {
  const files: Array<{ key: string; size: number; uploaded: string; etag: string; backup_key: string }> = [];
  let totalBytes = 0;
  let cursor: string | undefined;

  // List all objects in R2, excluding backups/ to avoid recursive backup
  do {
    const listed = await env.BACKUP_R2.list({ cursor, limit: 1000 });
    for (const obj of listed.objects) {
      // Skip backup directory itself to avoid backing up backups
      if (obj.key.startsWith("backups/")) continue;

      // Copy file to backup location (server-side copy - no bandwidth)
      const backupKey = `backups/r2/${date}/${obj.key}`;
      const sourceObj = await env.BACKUP_R2.get(obj.key);
      if (sourceObj) {
        await env.BACKUP_R2.put(backupKey, sourceObj.body, {
          httpMetadata: sourceObj.httpMetadata,
          customMetadata: {
            ...sourceObj.customMetadata,
            backup_source: obj.key,
            backup_date: date,
          },
        });
      }

      // Add to manifest
      files.push({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        etag: obj.etag,
        backup_key: backupKey,
      });
      totalBytes += obj.size;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return {
    date,
    total_files: files.length,
    total_bytes: totalBytes,
    files,
  };
}

/**
 * Remove older R2 backups beyond retention. Must only be called after runBackup() has succeeded
 * so we never delete the oldest until a new backup is safely written.
 */
async function applyRetention(env: Env): Promise<void> {
  const days = Math.max(1, parseInt(env.BACKUP_RETENTION_DAYS || "30", 10));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Clean up D1 and KV backups
  for (const prefix of ["backups/d1/", "backups/kv/"]) {
    const list = await env.BACKUP_R2.list({ prefix });
    for (const obj of list.objects) {
      const keyDate = obj.key.replace(prefix, "").replace(".sql.gz", "").replace("whitelist-", "").replace(".json", "");
      if (keyDate < cutoffStr) await env.BACKUP_R2.delete(obj.key);
    }
  }

  // Clean up old R2 file backups (entire date directories)
  const r2BackupsList = await env.BACKUP_R2.list({ prefix: "backups/r2/", delimiter: "/" });
  for (const dir of r2BackupsList.delimitedPrefixes || []) {
    // Extract date from "backups/r2/YYYY-MM-DD/"
    const match = /backups\/r2\/(\d{4}-\d{2}-\d{2})\//.exec(dir);
    if (match && match[1]! < cutoffStr) {
      // Delete all files in this date directory
      let cursor: string | undefined;
      do {
        const objects = await env.BACKUP_R2.list({ prefix: dir, cursor, limit: 1000 });
        for (const obj of objects.objects) {
          await env.BACKUP_R2.delete(obj.key);
        }
        cursor = objects.truncated ? objects.cursor : undefined;
      } while (cursor);
    }
  }
}

/** Record last R2 backup time in backup_config so the portal can show "last run" (no secrets). */
async function recordLastBackupTime(env: Env): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `UPDATE backup_config SET last_r2_backup_at = datetime('now') WHERE id = 1`
    ).run();
  } catch (e) {
    // Column may not exist yet; log but don't fail the backup
    console.warn("Could not update last_r2_backup_at:", e);
  }
}

/**
 * Cleanup old data after backup completes. Runs daily but only deletes data older than retention periods.
 * This consolidates all data cleanup tasks in one place (replaces separate contact-cleanup worker).
 */
async function cleanupOldData(env: Env): Promise<void> {
  if (!env.DB) return;

  try {
    // 1. Delete contact form submissions older than 1 year
    // Contact forms are logged as backup in case email fails; board can view at /board/contacts
    const contactResult = await env.DB.prepare(
      "DELETE FROM contact_submissions WHERE created_at < datetime('now', '-1 year')"
    ).run();
    const contactDeleted = contactResult.meta.changes ?? 0;
    if (contactDeleted > 0) {
      console.log(`Cleaned up ${contactDeleted} old contact submission(s) (>1 year)`);
    }

    // 2. Delete old rate limit entries (>7 days)
    // Rate limits are only relevant for recent activity
    const rateLimitResult = await env.DB.prepare(
      "DELETE FROM rate_limits WHERE created_at < datetime('now', '-7 days')"
    ).run();
    const rateLimitDeleted = rateLimitResult.meta.changes ?? 0;
    if (rateLimitDeleted > 0) {
      console.log(`Cleaned up ${rateLimitDeleted} old rate limit(s) (>7 days)`);
    }

    // 3. Delete old directory access logs (>1 year)
    // Keep 1 year of audit trail for phone number reveals
    const directoryResult = await env.DB.prepare(
      "DELETE FROM directory_logs WHERE viewed_at < datetime('now', '-1 year')"
    ).run();
    const directoryDeleted = directoryResult.meta.changes ?? 0;
    if (directoryDeleted > 0) {
      console.log(`Cleaned up ${directoryDeleted} old directory log(s) (>1 year)`);
    }

    // Add more cleanup tasks here as needed (login_history, old notifications, etc.)

  } catch (e) {
    // Log but don't fail the backup if cleanup fails
    console.warn("Data cleanup encountered an error:", e);
  }
}

/**
 * Phase 3: read backup_config from D1; if Google Drive enabled and schedule matches, upload to Drive.
 * Any future retention (deleting oldest on Drive) must run only after all uploads for this run succeed.
 */
async function maybeUploadToGoogleDrive(env: Env, date: string): Promise<void> {
  if (!env.DB) return;
  const row = await env.DB.prepare(
    "SELECT google_refresh_token_encrypted, google_drive_folder_id, schedule_type, schedule_hour_utc, schedule_day_of_week FROM backup_config WHERE google_drive_enabled = 1 LIMIT 1"
  ).first<{
    google_refresh_token_encrypted: string | null;
    google_drive_folder_id: string | null;
    schedule_type: string | null;
    schedule_hour_utc: number | null;
    schedule_day_of_week: number | null;
  }>();
  if (!row?.google_drive_folder_id || !row.google_refresh_token_encrypted) return;

  const now = new Date();
  const hourUtc = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  if (row.schedule_type === "daily" && row.schedule_hour_utc != null && row.schedule_hour_utc !== hourUtc) return;
  if (row.schedule_type === "weekly" && (row.schedule_day_of_week != null && row.schedule_day_of_week !== dayOfWeek || row.schedule_hour_utc != null && row.schedule_hour_utc !== hourUtc))
    return;

  const encryptionKey = (env as unknown as { BACKUP_ENCRYPTION_KEY?: string }).BACKUP_ENCRYPTION_KEY;
  const clientId = (env as unknown as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID;
  const clientSecret = (env as unknown as { GOOGLE_CLIENT_SECRET?: string }).GOOGLE_CLIENT_SECRET;
  if (!encryptionKey || !clientId || !clientSecret) return;

  // Decrypt refresh token (simple XOR or use Web Crypto; for now assume we have a decrypt helper)
  const refreshToken = await decryptRefreshToken(row.google_refresh_token_encrypted, encryptionKey);
  const accessToken = await getGoogleAccessToken(clientId, clientSecret, refreshToken);
  const folderId = row.google_drive_folder_id;

  const d1Key = `backups/d1/${date}.sql.gz`;
  const kvKey = `backups/kv/whitelist-${date}.json`;
  const manifestKey = `backups/r2/${date}/manifest.json`;

  const d1Obj = await env.BACKUP_R2.get(d1Key);
  const kvObj = await env.BACKUP_R2.get(kvKey);
  const manifestObj = await env.BACKUP_R2.get(manifestKey);

  if (d1Obj) await uploadToDrive(env, accessToken, folderId, `${date}-database.sql.gz`, d1Obj.body, "application/gzip");
  if (kvObj) await uploadToDrive(env, accessToken, folderId, `${date}-whitelist.json`, kvObj.body, "application/json");
  if (manifestObj) await uploadToDrive(env, accessToken, folderId, `${date}-r2-manifest.json`, manifestObj.body, "application/json");

  // Retention only after uploads succeed: keep 4 weekly, 4 monthly, 1 yearly
  await applyDriveRetention(accessToken, folderId);
  await recordLastGoogleBackupTime(env);
}

async function decryptRefreshToken(encrypted: string, key: string): Promise<string> {
  // Simple base64 decode + XOR with key (key repeated). In production use proper AEAD (e.g. AES-GCM).
  const keyBytes = new TextEncoder().encode(key);
  const buf = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i]! ^ keyBytes[i % keyBytes.length]!;
  return new TextDecoder().decode(out);
}

async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in Google response");
  return data.access_token;
}

async function uploadToDrive(
  _env: Env,
  accessToken: string,
  folderId: string,
  name: string,
  body: ReadableStream<Uint8Array> | null,
  mimeType: string
): Promise<void> {
  if (!body) return;
  const bytes = await new Response(body).arrayBuffer();
  const boundary = "backup_" + Date.now();
  const meta = JSON.stringify({ name, parents: [folderId] });
  const part1 = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`;
  const part2Header = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const part3 = `\r\n--${boundary}--`;
  const b1 = new TextEncoder().encode(part1);
  const b2 = new TextEncoder().encode(part2Header);
  const b3 = new Uint8Array(bytes);
  const b4 = new TextEncoder().encode(part3);
  const combined = new Uint8Array(b1.length + b2.length + b3.length + b4.length);
  let off = 0;
  combined.set(b1, off); off += b1.length;
  combined.set(b2, off); off += b2.length;
  combined.set(b3, off); off += b3.length;
  combined.set(b4, off);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(combined.length),
    },
    body: combined,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${await res.text()}`);
}

/** List files in a Drive folder (all pages). */
async function listDriveFiles(accessToken: string, folderId: string): Promise<{ id: string; name: string }[]> {
  const files: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const q = `'${folderId}' in parents`;
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "nextPageToken, files(id, name)");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Drive list failed: ${await res.text()}`);
    const data = (await res.json()) as { nextPageToken?: string; files?: { id: string; name: string }[] };
    if (data.files) files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/** Parse backup date from scheduled backup filename; returns YYYY-MM-DD or null. */
function parseBackupDateFromName(name: string): string | null {
  const m1 = /^(\d{4}-\d{2}-\d{2})\.sql\.gz$/.exec(name);
  if (m1) return m1[1]!;
  const m2 = /^whitelist-(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
  if (m2) return m2[1]!;
  return null;
}

/**
 * Drive retention: keep 4 weekly (most recent), 4 monthly (one per month), 1 yearly.
 * Only call after uploads for this run have succeeded.
 */
async function applyDriveRetention(accessToken: string, folderId: string): Promise<void> {
  const files = await listDriveFiles(accessToken, folderId);
  const byDate = new Map<string, { id: string; name: string }[]>();
  for (const f of files) {
    const d = parseBackupDateFromName(f.name);
    if (!d) continue;
    const list = byDate.get(d) ?? [];
    list.push(f);
    byDate.set(d, list);
  }
  const dates = [...byDate.keys()].sort().reverse();
  if (dates.length === 0) return;

  const keep = new Set<string>();
  // 4 most recent
  for (let i = 0; i < Math.min(4, dates.length); i++) keep.add(dates[i]!);
  // 1 per calendar month for last 4 months
  const now = new Date();
  for (let m = 0; m < 4; m++) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    const prefix = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-`;
    const inMonth = dates.filter((d) => d.startsWith(prefix));
    if (inMonth.length) keep.add(inMonth[0]!);
  }
  // 1 yearly: most recent date that is at least 31 days ago (and within 365 days)
  const cutoffYear = new Date(now);
  cutoffYear.setUTCDate(cutoffYear.getUTCDate() - 365);
  const cutoff31 = new Date(now);
  cutoff31.setUTCDate(cutoff31.getUTCDate() - 31);
  const cutoff31Str = cutoff31.toISOString().slice(0, 10);
  const cutoffYearStr = cutoffYear.toISOString().slice(0, 10);
  for (const d of dates) {
    if (d <= cutoff31Str && d >= cutoffYearStr) {
      keep.add(d);
      break;
    }
  }

  for (const date of dates) {
    if (keep.has(date)) continue;
    for (const f of byDate.get(date) ?? []) {
      const del = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!del.ok && del.status !== 404) console.warn(`Drive delete failed for ${f.name}: ${del.status}`);
    }
  }
}

/** Record last Google backup time in backup_config (only after uploads + retention succeed). */
async function recordLastGoogleBackupTime(env: Env): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `UPDATE backup_config SET last_google_backup_at = datetime('now') WHERE id = 1`
    ).run();
  } catch (e) {
    console.warn("Could not update last_google_backup_at:", e);
  }
}
