/**
 * D1 helpers for vendor submissions (suggest-a-vendor workflow).
 */

import { listEmailsAtSameAddress } from './directory-db.js';

const ID_LEN = 21;

const VENDOR_SUBMISSIONS_SELECT = `SELECT id, name, category, phone, email, website, notes, files, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes, created_vendor_id
  FROM vendor_submissions`;

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

export type VendorSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface VendorSubmission {
  id: string;
  name: string | null;
  category: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  files: string;
  status: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_vendor_id: string | null;
}

export async function listPendingSubmissions(db: D1Database): Promise<VendorSubmission[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, category, phone, email, website, notes, files, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes, created_vendor_id
       FROM vendor_submissions WHERE status = 'pending' ORDER BY submitted_at DESC`
    )
    .all<VendorSubmission>();
  return results ?? [];
}

export async function listSubmissions(db: D1Database, options?: { status?: string }): Promise<VendorSubmission[]> {
  if (options?.status) {
    const { results } = await db
      .prepare(`${VENDOR_SUBMISSIONS_SELECT} WHERE status = ? ORDER BY submitted_at DESC`)
      .bind(options.status)
      .all<VendorSubmission>();
    return results ?? [];
  }
  const { results } = await db
    .prepare(`${VENDOR_SUBMISSIONS_SELECT} ORDER BY submitted_at DESC`)
    .all<VendorSubmission>();
  return results ?? [];
}

/** List submissions where submitted_by is any of the given emails (e.g. household). */
export async function listSubmissionsBySubmitterEmails(
  db: D1Database,
  submitterEmails: string[]
): Promise<VendorSubmission[]> {
  const emails = submitterEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) return [];
  const placeholders = emails.map(() => '?').join(',');
  const { results } = await db
    .prepare(`${VENDOR_SUBMISSIONS_SELECT} WHERE submitted_by IN (${placeholders}) ORDER BY submitted_at DESC`)
    .bind(...emails)
    .all<VendorSubmission>();
  return results ?? [];
}

/** List vendor submissions from the household of the given user (same property address). */
export async function listVendorSubmissionsByHousehold(
  db: D1Database,
  userEmail: string
): Promise<VendorSubmission[]> {
  const emails = await listEmailsAtSameAddress(db, userEmail);
  return listSubmissionsBySubmitterEmails(db, emails);
}

export async function getSubmissionById(db: D1Database, id: string): Promise<VendorSubmission | null> {
  return db
    .prepare(
      `SELECT id, name, category, phone, email, website, notes, files, status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes, created_vendor_id
       FROM vendor_submissions WHERE id = ?`
    )
    .bind(id)
    .first<VendorSubmission>();
}

export async function insertSubmission(
  db: D1Database,
  data: {
    name: string;
    category: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    notes: string | null;
    filesJson: string;
    submittedBy: string;
  }
): Promise<string> {
  const id = generateId();
  await db
    .prepare(
      `INSERT INTO vendor_submissions (id, name, category, phone, email, website, notes, files, status, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(
      id,
      data.name.trim(),
      data.category?.trim() ?? null,
      data.phone?.trim() ?? null,
      data.email?.trim()?.toLowerCase() ?? null,
      data.website?.trim() ?? null,
      data.notes?.trim() ?? null,
      data.filesJson,
      data.submittedBy.trim().toLowerCase()
    )
    .run();
  return id;
}

export async function updateSubmissionStatus(
  db: D1Database,
  id: string,
  status: VendorSubmissionStatus,
  reviewedBy: string,
  reviewNotes: string | null,
  createdVendorId: string | null
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE vendor_submissions SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_notes = ?, created_vendor_id = ?
       WHERE id = ? AND status = 'pending'`
    )
    .bind(status, reviewedBy.trim().toLowerCase(), reviewNotes ?? null, createdVendorId ?? null, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
