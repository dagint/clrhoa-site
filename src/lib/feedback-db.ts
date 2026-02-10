/**
 * D1 helpers for Phase 5: Document feedback / sign-off.
 */

import { listEmailsAtSameAddress } from './directory-db.js';

export interface FeedbackDoc {
  id: string;
  title: string | null;
  description: string | null;
  r2_key: string | null;
  deadline: string | null;
  created_by: string | null;
  created: string;
}

export interface FeedbackResponse {
  doc_id: string;
  owner_email: string;
  acknowledged: number;
  approved: number | null;
  comments: string | null;
  responded: string;
}

const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateId(len: number = 14): string {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < len; i++) id += ID_CHARS[bytes[i]! % ID_CHARS.length];
  return id;
}

export function createFeedbackDocId(): string {
  return `fd_${generateId(12)}`;
}

/** List active feedback docs (deadline >= today or null), deadline descending. */
export async function listActiveFeedbackDocs(db: D1Database): Promise<FeedbackDoc[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT id, title, description, r2_key, deadline, created_by, created
       FROM feedback_docs WHERE deadline >= ? OR deadline IS NULL ORDER BY deadline IS NULL, deadline DESC, created DESC`
    )
    .bind(today)
    .all<FeedbackDoc>();
  return results ?? [];
}

/** List all feedback docs for board (newest first). */
export async function listAllFeedbackDocs(db: D1Database, limit = 500, offset = 0): Promise<FeedbackDoc[]> {
  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const safeOffset = Math.max(0, offset);
  const { results } = await db
    .prepare(
      'SELECT id, title, description, r2_key, deadline, created_by, created FROM feedback_docs ORDER BY created DESC LIMIT ? OFFSET ?'
    )
    .bind(safeLimit, safeOffset)
    .all<FeedbackDoc>();
  return results ?? [];
}

/** Get one doc by id. */
export async function getFeedbackDocById(db: D1Database, id: string): Promise<FeedbackDoc | null> {
  return db
    .prepare(
      'SELECT id, title, description, r2_key, deadline, created_by, created FROM feedback_docs WHERE id = ? LIMIT 1'
    )
    .bind(id)
    .first<FeedbackDoc>();
}

/** Get response for one owner + doc. */
export async function getFeedbackResponse(
  db: D1Database,
  docId: string,
  ownerEmail: string
): Promise<FeedbackResponse | null> {
  const email = ownerEmail.trim().toLowerCase();
  return db
    .prepare(
      'SELECT doc_id, owner_email, acknowledged, approved, comments, responded FROM feedback_responses WHERE doc_id = ? AND owner_email = ? LIMIT 1'
    )
    .bind(docId, email)
    .first<FeedbackResponse>();
}

/** True if any member of the household (same address) has responded to this doc. */
export async function householdHasResponded(
  db: D1Database,
  docId: string,
  userEmail: string
): Promise<boolean> {
  const emails = await listEmailsAtSameAddress(db, userEmail);
  if (emails.length === 0) return false;
  const placeholders = emails.map(() => '?').join(',');
  const row = await db
    .prepare(
      `SELECT 1 FROM feedback_responses WHERE doc_id = ? AND owner_email IN (${placeholders}) LIMIT 1`
    )
    .bind(docId, ...emails)
    .first<{ '1'?: number }>();
  return row != null;
}

/** Upsert owner response (acknowledged, approved, comments). */
export async function setFeedbackResponse(
  db: D1Database,
  docId: string,
  ownerEmail: string,
  data: { acknowledged: boolean; approved: boolean | null; comments?: string | null }
): Promise<void> {
  const email = ownerEmail.trim().toLowerCase();
  const ack = data.acknowledged ? 1 : 0;
  const approved = data.approved === true ? 1 : data.approved === false ? 0 : null;
  const comments = data.comments?.trim() || null;
  await db
    .prepare(
      `INSERT INTO feedback_responses (doc_id, owner_email, acknowledged, approved, comments, responded)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(doc_id, owner_email) DO UPDATE SET
         acknowledged = excluded.acknowledged,
         approved = excluded.approved,
         comments = excluded.comments,
         responded = datetime('now')`
    )
    .bind(docId, email, ack, approved, comments)
    .run();
}

/** Count responses for a doc: total, acknowledged, approved, rejected. */
export async function getFeedbackResponseCounts(
  db: D1Database,
  docId: string
): Promise<{ total: number; responded: number; approved: number; rejected: number }> {
  const totalRow = await db
    .prepare('SELECT COUNT(*) as n FROM feedback_responses WHERE doc_id = ?')
    .bind(docId)
    .first<{ n: number }>();
  const approvedRow = await db
    .prepare('SELECT COUNT(*) as n FROM feedback_responses WHERE doc_id = ? AND approved = 1')
    .bind(docId)
    .first<{ n: number }>();
  const rejectedRow = await db
    .prepare('SELECT COUNT(*) as n FROM feedback_responses WHERE doc_id = ? AND approved = 0')
    .bind(docId)
    .first<{ n: number }>();
  return {
    total: totalRow?.n ?? 0,
    responded: totalRow?.n ?? 0,
    approved: approvedRow?.n ?? 0,
    rejected: rejectedRow?.n ?? 0,
  };
}

/** List all responses for a doc (for CSV export). */
export async function listFeedbackResponses(
  db: D1Database,
  docId: string
): Promise<FeedbackResponse[]> {
  const { results } = await db
    .prepare(
      'SELECT doc_id, owner_email, acknowledged, approved, comments, responded FROM feedback_responses WHERE doc_id = ? ORDER BY responded ASC'
    )
    .bind(docId)
    .all<FeedbackResponse>();
  return results ?? [];
}

/** Insert feedback doc. */
export async function insertFeedbackDoc(
  db: D1Database,
  id: string,
  data: { title: string; description: string | null; r2_key: string | null; deadline: string | null; created_by: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO feedback_docs (id, title, description, r2_key, deadline, created_by, created)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      data.title.trim(),
      data.description?.trim() || null,
      data.r2_key ?? null,
      data.deadline || null,
      data.created_by
    )
    .run();
}

/** Update feedback doc. */
export async function updateFeedbackDoc(
  db: D1Database,
  id: string,
  data: { title?: string; description?: string | null; r2_key?: string | null; deadline?: string | null }
): Promise<boolean> {
  const doc = await getFeedbackDocById(db, id);
  if (!doc) return false;
  await db
    .prepare(
      `UPDATE feedback_docs SET
        title = COALESCE(?, title),
        description = ?,
        r2_key = COALESCE(?, r2_key),
        deadline = ?
       WHERE id = ?`
    )
    .bind(
      data.title !== undefined ? data.title.trim() : doc.title,
      data.description !== undefined ? (data.description?.trim() || null) : doc.description,
      data.r2_key !== undefined ? data.r2_key : doc.r2_key,
      data.deadline !== undefined ? data.deadline : doc.deadline,
      id
    )
    .run();
  return true;
}

/** Delete feedback doc (and responses). */
export async function deleteFeedbackDoc(db: D1Database, id: string): Promise<boolean> {
  await db.prepare('DELETE FROM feedback_responses WHERE doc_id = ?').bind(id).run();
  const r = await db.prepare('DELETE FROM feedback_docs WHERE id = ?').bind(id).run();
  return r.meta.changes > 0;
}
