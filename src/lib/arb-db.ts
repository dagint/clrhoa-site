/**
 * D1 helpers for ARB requests and files (Phase 2).
 */
/// <reference types="@cloudflare/workers-types" />

import { listEmailsAtSameAddress } from './directory-db.js';
import { generateId } from '../utils/id-generator.js';

export interface ArbRequest {
  id: string;
  owner_email: string;
  applicant_name: string | null;
  phone: string | null;
  property_address: string | null;
  application_type: string | null;
  description: string;
  status: string;
  esign_timestamp: string | null;
  arb_esign: string | null;
  created: string;
  updated_at: string | null;
  copied_from_id?: string | null;
  revision_notes?: string | null;
  arb_internal_notes?: string | null;
  owner_notes?: string | null;
  review_deadline?: string | null;
  deleted_at?: string | null;
}

export interface ArbFile {
  id: string;
  request_id: string;
  filename: string;
  r2_keys: string;
  original_size: number;
  reference_only?: number;
}

export interface ArbAuditLogRow {
  id: number;
  request_id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  changed_by_email: string | null;
  changed_by_role: string | null;
  notes: string | null;
  created: string | null;
  ip_address: string | null;
}

/** Human-readable request number: ARB-YYYY-NNNN (e.g. ARB-2026-0001). Requires DB to get next sequence. */
export async function getNextArbRequestId(db: D1Database): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ARB-${year}-`;
  const row = await db
    .prepare(
      `SELECT id FROM arb_requests WHERE id LIKE ? ORDER BY id DESC LIMIT 1`
    )
    .bind(prefix + '%')
    .first<{ id: string }>();
  let nextNum = 1;
  if (row?.id) {
    const parts = row.id.split('-');
    const last = parts[parts.length - 1];
    const n = parseInt(last ?? '0', 10);
    if (!Number.isNaN(n)) nextNum = n + 1;
  }
  const padded = String(nextNum).padStart(4, '0');
  return `${prefix}${padded}`;
}

export function createArbFileId(): string {
  return generateId();
}

export async function insertArbRequest(
  db: D1Database,
  id: string,
  ownerEmail: string,
  description: string,
  options?: {
    applicantName?: string | null;
    phone?: string | null;
    propertyAddress?: string | null;
    applicationType?: string | null;
    copiedFromId?: string | null;
    ip_address?: string | null;
  }
): Promise<void> {
  const applicantName = options?.applicantName?.trim() || null;
  const phone = options?.phone?.trim() || null;
  const propertyAddress = options?.propertyAddress?.trim() || null;
  const applicationType = options?.applicationType?.trim() || null;
  const copiedFromId = options?.copiedFromId?.trim() || null;
  await db
    .prepare(
      `INSERT INTO arb_requests (id, owner_email, applicant_name, phone, property_address, application_type, description, status, created, copied_from_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), ?)`
    )
    .bind(id, ownerEmail.trim().toLowerCase(), applicantName, phone, propertyAddress, applicationType, description, copiedFromId)
    .run();

  // Log creation to audit table
  const ipAddress = options?.ip_address?.trim() || null;
  try {
    await db
      .prepare(
        `INSERT INTO arb_audit_log (request_id, action, old_status, new_status, changed_by_email, changed_by_role, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, 'create', null, 'pending', ownerEmail.trim().toLowerCase(), 'owner', ipAddress)
      .run();
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}

export async function getArbRequest(
  db: D1Database,
  id: string
): Promise<ArbRequest | null> {
  const row = await db
    .prepare(
      'SELECT id, owner_email, applicant_name, phone, property_address, application_type, description, status, esign_timestamp, arb_esign, created, updated_at, copied_from_id, revision_notes, arb_internal_notes, owner_notes, review_deadline, deleted_at FROM arb_requests WHERE id = ? AND (deleted_at IS NULL OR deleted_at = "") LIMIT 1'
    )
    .bind(id)
    .first<ArbRequest & { arb_internal_notes?: string | null; owner_notes?: string | null; review_deadline?: string | null; deleted_at?: string | null }>();
  if (!row) return null;
  return {
    ...row,
    arb_internal_notes: row.arb_internal_notes ?? null,
    owner_notes: row.owner_notes ?? null,
    review_deadline: row.review_deadline ?? null,
    deleted_at: row.deleted_at ?? null,
  } as ArbRequest;
}

export async function listArbRequestsByOwner(
  db: D1Database,
  ownerEmail: string
): Promise<ArbRequest[]> {
  const { results } = await db
    .prepare(
      'SELECT id, owner_email, applicant_name, phone, property_address, application_type, description, status, esign_timestamp, arb_esign, created, updated_at, copied_from_id, revision_notes, arb_internal_notes, owner_notes, review_deadline, deleted_at FROM arb_requests WHERE owner_email = ? AND (deleted_at IS NULL OR deleted_at = "") ORDER BY created DESC'
    )
    .bind(ownerEmail.trim().toLowerCase())
    .all<ArbRequest & { arb_internal_notes?: string | null; owner_notes?: string | null; review_deadline?: string | null; deleted_at?: string | null }>();
  return (results ?? []).map(row => ({
    ...row,
    arb_internal_notes: row.arb_internal_notes ?? null,
    owner_notes: row.owner_notes ?? null,
    review_deadline: row.review_deadline ?? null,
    deleted_at: row.deleted_at ?? null,
  })) as ArbRequest[];
}

const ARB_REQUEST_SELECT =
  'SELECT id, owner_email, applicant_name, phone, property_address, application_type, description, status, esign_timestamp, arb_esign, created, updated_at, copied_from_id, revision_notes, arb_internal_notes, owner_notes, review_deadline, deleted_at FROM arb_requests';
const ARB_REQUEST_DELETED_COND = ' (deleted_at IS NULL OR deleted_at = "") ';
type ArbRequestRow = ArbRequest & { arb_internal_notes?: string | null; owner_notes?: string | null; review_deadline?: string | null; deleted_at?: string | null };

function mapArbRequestRow(row: ArbRequestRow): ArbRequest {
  return {
    ...row,
    arb_internal_notes: row.arb_internal_notes ?? null,
    owner_notes: row.owner_notes ?? null,
    review_deadline: row.review_deadline ?? null,
    deleted_at: row.deleted_at ?? null,
  } as ArbRequest;
}

/** List ARB requests for any of the given owner emails (e.g. household). */
export async function listArbRequestsByOwnerEmails(
  db: D1Database,
  ownerEmails: string[]
): Promise<ArbRequest[]> {
  const emails = ownerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) return [];
  const placeholders = emails.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `${ARB_REQUEST_SELECT} WHERE owner_email IN (${placeholders}) AND ${ARB_REQUEST_DELETED_COND} ORDER BY created DESC`
    )
    .bind(...emails)
    .all<ArbRequestRow>();
  return (results ?? []).map(mapArbRequestRow);
}

/** List ARB requests for the household of the given user (same property address). */
export async function listArbRequestsByHousehold(
  db: D1Database,
  userEmail: string
): Promise<ArbRequest[]> {
  const emails = await listEmailsAtSameAddress(db, userEmail);
  return listArbRequestsByOwnerEmails(db, emails);
}

export async function listAllArbRequests(db: D1Database): Promise<ArbRequest[]> {
  const { results } = await db
    .prepare(
      'SELECT id, owner_email, applicant_name, phone, property_address, application_type, description, status, esign_timestamp, arb_esign, created, updated_at, copied_from_id, revision_notes, arb_internal_notes, owner_notes, review_deadline, deleted_at FROM arb_requests WHERE deleted_at IS NULL OR deleted_at = "" ORDER BY created DESC'
    )
    .all<ArbRequest & { arb_internal_notes?: string | null; owner_notes?: string | null; review_deadline?: string | null; deleted_at?: string | null }>();
  return (results ?? []).map(row => ({
    ...row,
    arb_internal_notes: row.arb_internal_notes ?? null,
    owner_notes: row.owner_notes ?? null,
    review_deadline: row.review_deadline ?? null,
    deleted_at: row.deleted_at ?? null,
  })) as ArbRequest[];
}

export interface ArbExportFilters {
  /** Inclusive start date (YYYY-MM-DD). Filters by created date. */
  fromDate?: string | null;
  /** Inclusive end date (YYYY-MM-DD). Filters by created date. */
  toDate?: string | null;
  /** Filter by status (pending, in_review, approved, rejected, cancelled). */
  status?: string | null;
}

/** List all ARB requests with optional date/status filters for export/reports. */
export async function listAllArbRequestsFiltered(
  db: D1Database,
  filters?: ArbExportFilters
): Promise<ArbRequest[]> {
  const conditions: string[] = ['(deleted_at IS NULL OR deleted_at = "")'];
  const bind: (string | number)[] = [];
  if (filters?.fromDate?.trim()) {
    conditions.push('date(created) >= date(?)');
    bind.push(filters.fromDate.trim());
  }
  if (filters?.toDate?.trim()) {
    conditions.push('date(created) <= date(?)');
    bind.push(filters.toDate.trim());
  }
  if (filters?.status?.trim()) {
    conditions.push('status = ?');
    bind.push(filters.status.trim().toLowerCase());
  }
  const where = conditions.join(' AND ');
  const { results } = await db
    .prepare(
      `SELECT id, owner_email, applicant_name, phone, property_address, application_type, description, status, esign_timestamp, arb_esign, created, updated_at, copied_from_id, revision_notes, arb_internal_notes, owner_notes, review_deadline, deleted_at FROM arb_requests WHERE ${where} ORDER BY created DESC`
    )
    .bind(...bind)
    .all<ArbRequest & { arb_internal_notes?: string | null; owner_notes?: string | null; review_deadline?: string | null; deleted_at?: string | null }>();
  return (results ?? []).map(row => ({
    ...row,
    arb_internal_notes: row.arb_internal_notes ?? null,
    owner_notes: row.owner_notes ?? null,
    review_deadline: row.review_deadline ?? null,
    deleted_at: row.deleted_at ?? null,
  })) as ArbRequest[];
}

/** Count of ARB requests by status (for dashboard badges). */
export async function getArbRequestCountsByStatus(db: D1Database): Promise<{ pending: number; in_review: number; approved: number; rejected: number; cancelled: number }> {
  const { results } = await db
    .prepare('SELECT status, COUNT(*) as cnt FROM arb_requests WHERE deleted_at IS NULL OR deleted_at = "" GROUP BY status')
    .all<{ status: string; cnt: number }>();
  const counts = { pending: 0, in_review: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const row of results ?? []) {
    const k = row.status as keyof typeof counts;
    if (k in counts) counts[k] = Number(row.cnt) || 0;
  }
  return counts;
}

export async function updateArbRequestStatus(
  db: D1Database,
  id: string,
  status: 'approved' | 'rejected',
  arbEsign: string,
  changedByEmail?: string,
  changedByRole?: string,
  ipAddress?: string | null
): Promise<boolean> {
  // Get old status for audit log
  const oldReq = await getArbRequest(db, id);
  const oldStatus = oldReq?.status ?? null;

  const result = await db
    .prepare(
      `UPDATE arb_requests SET status = ?, arb_esign = ?, esign_timestamp = datetime('now') WHERE id = ? AND status = 'in_review'`
    )
    .bind(status, arbEsign, id)
    .run();

  const updated = (result.meta.changes ?? 0) > 0;

  // Log to audit table
  if (updated) {
    try {
      await db
        .prepare(
          `INSERT INTO arb_audit_log (request_id, action, old_status, new_status, changed_by_email, changed_by_role, notes, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, status, oldStatus, status, changedByEmail ?? null, changedByRole ?? null, arbEsign, ipAddress?.trim() ?? null)
        .run();
    } catch (e) {
      console.error('[arb-db] Failed to write audit log:', e);
      // Don't fail the update if audit log fails
    }
  }

  return updated;
}

/** Owner submits/resubmits for review: pending → in_review. Clears revision_notes. */
export async function setArbRequestInReview(
  db: D1Database,
  id: string,
  ownerEmail: string,
  ipAddress?: string | null
): Promise<boolean> {
  const oldReq = await getArbRequest(db, id);
  const oldStatus = oldReq?.status ?? null;

  const result = await db
    .prepare(
      `UPDATE arb_requests SET status = 'in_review', revision_notes = NULL, updated_at = datetime('now') WHERE id = ? AND owner_email = ? AND status = 'pending'`
    )
    .bind(id, ownerEmail.trim().toLowerCase())
    .run();

  const updated = (result.meta.changes ?? 0) > 0;

  if (updated) {
    try {
      await db
        .prepare(
          `INSERT INTO arb_audit_log (request_id, action, old_status, new_status, changed_by_email, changed_by_role, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, 'submit_for_review', oldStatus, 'in_review', ownerEmail.trim().toLowerCase(), 'owner', ipAddress?.trim() ?? null)
        .run();
    } catch (e) {
      console.error('[arb-db] Failed to write audit log:', e);
    }
  }

  return updated;
}

/** ARB requests revision: in_review → pending (owner can edit again). Stores revision_notes for the owner. */
export async function setArbRequestPendingForRevision(
  db: D1Database,
  id: string,
  revisionNotes: string | null,
  changedByEmail?: string,
  changedByRole?: string,
  ipAddress?: string | null
): Promise<boolean> {
  const oldReq = await getArbRequest(db, id);
  const oldStatus = oldReq?.status ?? null;
  const notes = revisionNotes?.trim() || null;

  const result = await db
    .prepare(
      `UPDATE arb_requests SET status = 'pending', revision_notes = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_review'`
    )
    .bind(notes, id)
    .run();

  const updated = (result.meta.changes ?? 0) > 0;

  if (updated) {
    try {
      await db
        .prepare(
          `INSERT INTO arb_audit_log (request_id, action, old_status, new_status, changed_by_email, changed_by_role, notes, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, 'request_revision', oldStatus, 'pending', changedByEmail ?? null, changedByRole ?? null, notes, ipAddress?.trim() ?? null)
        .run();
    } catch (e) {
      console.error('[arb-db] Failed to write audit log:', e);
    }
  }

  return updated;
}

/** Update request fields (owner only, pending only). Sets updated_at. */
export async function updateArbRequestByOwner(
  db: D1Database,
  id: string,
  ownerEmail: string,
  data: {
    applicantName?: string | null;
    phone?: string | null;
    propertyAddress?: string | null;
    applicationType?: string | null;
    description?: string;
    ownerNotes?: string | null;
  }
): Promise<boolean> {
  const applicantName = data.applicantName?.trim() ?? null;
  const phone = data.phone?.trim() ?? null;
  const propertyAddress = data.propertyAddress?.trim() ?? null;
  const applicationType = data.applicationType?.trim() ?? null;
  const description = data.description?.trim();
  const ownerNotes = data.ownerNotes?.trim() ?? null;
  const result = await db
    .prepare(
      `UPDATE arb_requests SET applicant_name = ?, phone = ?, property_address = ?, application_type = ?, description = ?, owner_notes = ?, updated_at = datetime('now') WHERE id = ? AND owner_email = ? AND status = 'pending'`
    )
    .bind(applicantName, phone, propertyAddress, applicationType, description ?? '', ownerNotes, id, ownerEmail.trim().toLowerCase())
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function insertArbFile(
  db: D1Database,
  id: string,
  requestId: string,
  filename: string,
  r2Keys: string,
  originalSize: number,
  referenceOnly?: boolean
): Promise<void> {
  const ref = referenceOnly ? 1 : 0;
  await db
    .prepare(
      'INSERT INTO arb_files (id, request_id, filename, r2_keys, original_size, reference_only) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, requestId, filename, r2Keys, originalSize, ref)
    .run();
}

export async function listArbFilesByRequest(
  db: D1Database,
  requestId: string
): Promise<ArbFile[]> {
  const { results } = await db
    .prepare('SELECT id, request_id, filename, r2_keys, original_size, reference_only FROM arb_files WHERE request_id = ?')
    .bind(requestId)
    .all<ArbFile>();
  return results ?? [];
}

/**
 * Batch load files for multiple requests (avoids N+1 query problem).
 * Returns a map of requestId -> files array.
 */
export async function batchLoadArbFilesByRequests(
  db: D1Database,
  requestIds: string[]
): Promise<Record<string, ArbFile[]>> {
  if (requestIds.length === 0) {
    return {};
  }

  // Build placeholders for IN clause
  const placeholders = requestIds.map(() => '?').join(',');
  const query = `SELECT id, request_id, filename, r2_keys, original_size, reference_only
                 FROM arb_files
                 WHERE request_id IN (${placeholders})`;

  const { results } = await db
    .prepare(query)
    .bind(...requestIds)
    .all<ArbFile>();

  // Group files by request_id
  const filesByRequestId: Record<string, ArbFile[]> = {};
  for (const requestId of requestIds) {
    filesByRequestId[requestId] = [];
  }

  for (const file of results ?? []) {
    if (!filesByRequestId[file.request_id]) {
      filesByRequestId[file.request_id] = [];
    }
    filesByRequestId[file.request_id].push(file);
  }

  return filesByRequestId;
}

/** List ARB audit log entries (newest first) for the board audit-logs page. */
export async function listArbAuditLog(
  db: D1Database,
  limit: number = 500,
  offset = 0
): Promise<ArbAuditLogRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 2000));
  const safeOffset = Math.max(0, offset);
  const { results } = await db
    .prepare(
      `SELECT id, request_id, action, old_status, new_status, changed_by_email, changed_by_role, notes, created, ip_address
       FROM arb_audit_log ORDER BY created DESC LIMIT ? OFFSET ?`
    )
    .bind(safeLimit, safeOffset)
    .all<ArbAuditLogRow>();
  return (results ?? []).map((r) => ({ ...r, ip_address: r.ip_address ?? null }));
}

/** List ARB audit log entries for requests owned by the given email (activity on my requests). For portal "My activity" page. */
export async function listArbAuditLogForOwner(
  db: D1Database,
  ownerEmail: string,
  limit: number = 200,
  offset = 0
): Promise<ArbAuditLogRow[]> {
  const owner = ownerEmail.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safeOffset = Math.max(0, offset);
  const { results } = await db
    .prepare(
      `SELECT a.id, a.request_id, a.action, a.old_status, a.new_status, a.changed_by_email, a.changed_by_role, a.notes, a.created, a.ip_address
       FROM arb_audit_log a
       INNER JOIN arb_requests r ON r.id = a.request_id AND (r.deleted_at IS NULL OR r.deleted_at = '')
       WHERE r.owner_email = ?
       ORDER BY a.created DESC LIMIT ? OFFSET ?`
    )
    .bind(owner, safeLimit, safeOffset)
    .all<ArbAuditLogRow>();
  return (results ?? []).map((r) => ({ ...r, ip_address: r.ip_address ?? null }));
}

/** List ARB audit log entries for a single request (oldest first, for timeline). */
export async function listArbAuditLogForRequest(
  db: D1Database,
  requestId: string
): Promise<ArbAuditLogRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, request_id, action, old_status, new_status, changed_by_email, changed_by_role, notes, created, ip_address
       FROM arb_audit_log WHERE request_id = ? ORDER BY created ASC`
    )
    .bind(requestId)
    .all<ArbAuditLogRow>();
  return (results ?? []).map((r) => ({ ...r, ip_address: r.ip_address ?? null }));
}

/** Date when request was first submitted for review (in_review). Used for "days in review" display. */
export async function getSubmittedForReviewAt(
  db: D1Database,
  requestId: string
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT created FROM arb_audit_log
       WHERE request_id = ? AND action = 'submit_for_review' AND new_status = 'in_review'
       ORDER BY created ASC LIMIT 1`
    )
    .bind(requestId)
    .first<{ created: string | null }>();
  return row?.created ?? null;
}

export async function getArbFile(
  db: D1Database,
  fileId: string,
  requestId: string
): Promise<ArbFile | null> {
  const row = await db
    .prepare('SELECT id, request_id, filename, r2_keys, original_size, reference_only FROM arb_files WHERE id = ? AND request_id = ? LIMIT 1')
    .bind(fileId, requestId)
    .first<ArbFile>();
  return row;
}

export async function deleteArbFile(db: D1Database, fileId: string, requestId: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM arb_files WHERE id = ? AND request_id = ?')
    .bind(fileId, requestId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Delete all file records for a request (used when cancelling). Returns number deleted. */
export async function deleteAllArbFilesByRequest(db: D1Database, requestId: string): Promise<number> {
  const result = await db
    .prepare('DELETE FROM arb_files WHERE request_id = ?')
    .bind(requestId)
    .run();
  return result.meta.changes ?? 0;
}

/** Owner cancels a pending request. Sets status to 'cancelled'; callers must delete R2 objects and file rows first. */
export async function cancelArbRequest(
  db: D1Database,
  requestId: string,
  ownerEmail: string,
  ipAddress?: string | null
): Promise<boolean> {
  const oldReq = await getArbRequest(db, requestId);
  const oldStatus = oldReq?.status ?? null;

  const result = await db
    .prepare(
      `UPDATE arb_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND owner_email = ? AND status = 'pending'`
    )
    .bind(requestId, ownerEmail.trim().toLowerCase())
    .run();

  const updated = (result.meta.changes ?? 0) > 0;

  if (updated) {
    try {
      await db
        .prepare(
          `INSERT INTO arb_audit_log (request_id, action, old_status, new_status, changed_by_email, changed_by_role, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(requestId, 'cancel', oldStatus, 'cancelled', ownerEmail.trim().toLowerCase(), 'owner', ipAddress?.trim() ?? null)
        .run();
    } catch (e) {
      console.error('[arb-db] Failed to write audit log:', e);
    }
  }

  return updated;
}

/**
 * Copy an approved or rejected request into a new pending request (same owner).
 * Copies only form data and attachment pointers (reference_only=1). Intentionally does
 * not copy approval/denial (arb_esign, esign_timestamp) or revision_notes.
 * Returns the new request id.
 */
export async function copyArbRequest(
  db: D1Database,
  sourceRequestId: string,
  ownerEmail: string,
  ipAddress?: string | null
): Promise<string> {
  const source = await getArbRequest(db, sourceRequestId);
  if (!source || source.owner_email !== ownerEmail.trim().toLowerCase()) {
    throw new Error('Request not found or you do not own it.');
  }
  if (source.status !== 'approved' && source.status !== 'rejected') {
    throw new Error('Only approved or rejected requests can be copied.');
  }

  const newId = await getNextArbRequestId(db);
  // Only form fields + copied_from_id; arb_esign, esign_timestamp, revision_notes stay NULL
  await insertArbRequest(db, newId, source.owner_email, source.description, {
    applicantName: source.applicant_name,
    phone: source.phone,
    propertyAddress: source.property_address,
    applicationType: source.application_type,
    copiedFromId: sourceRequestId,
    ip_address: ipAddress,
  });

  const files = await listArbFilesByRequest(db, sourceRequestId);
  for (const f of files) {
    const newFileId = createArbFileId();
    await insertArbFile(db, newFileId, newId, f.filename, f.r2_keys, f.original_size, true);
  }

  return newId;
}
