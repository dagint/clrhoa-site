/**
 * D1 helpers for SMS feature requests (lot_number + timestamp).
 * Used to report "X users want SMS" to admin; actual SMS sending is disabled.
 */

const ID_LEN = 21;

function generateId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  const bytes = new Uint8Array(ID_LEN);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < ID_LEN; i++) id += chars[bytes[i]! % chars.length];
  } else {
    for (let i = 0; i < ID_LEN; i++) id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export interface SmsFeatureRequestRow {
  id: string;
  lot_number: string;
  created_at: string;
}

export async function insertSmsFeatureRequest(
  db: D1Database,
  data: { lot_number: string }
): Promise<string> {
  const id = generateId();
  const lot = (data.lot_number ?? '').trim().slice(0, 16);
  if (!lot) throw new Error('lot_number required');

  await db
    .prepare(
      `INSERT INTO sms_feature_requests (id, lot_number, created_at)
       VALUES (?, ?, datetime('now'))`
    )
    .bind(id, lot)
    .run();

  return id;
}

export interface SmsFeatureRequestCounts {
  distinctLots: number;
  totalRequests: number;
}

export async function getSmsFeatureRequestCounts(db: D1Database): Promise<SmsFeatureRequestCounts> {
  const countAll = await db
    .prepare(`SELECT COUNT(*) as n FROM sms_feature_requests`)
    .first<{ n: number }>();
  const countLots = await db
    .prepare(`SELECT COUNT(DISTINCT lot_number) as n FROM sms_feature_requests`)
    .first<{ n: number }>();
  return {
    totalRequests: countAll?.n ?? 0,
    distinctLots: countLots?.n ?? 0,
  };
}

export async function listSmsFeatureRequests(
  db: D1Database,
  limit = 500
): Promise<SmsFeatureRequestRow[]> {
  const cap = Math.min(Math.max(limit, 1), 5000);
  const { results } = await db
    .prepare(
      `SELECT id, lot_number, created_at
       FROM sms_feature_requests
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(cap)
    .all<SmsFeatureRequestRow>();

  return results ?? [];
}
