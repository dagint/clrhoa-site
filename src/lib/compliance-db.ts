/**
 * D1 helpers for Florida HOA compliance tracking system.
 * Tracks 15 statutory requirements from FL §720.303(4).
 */

// ========== INTERFACES ==========

export interface ComplianceRequirement {
  id: string; // e.g., 'HOA-01'
  statute_ref: string; // e.g., '§720.303(4)(b)1.a'
  title: string;
  description: string;
  category: string; // 'governing_docs', 'financial', 'meetings', 'contracts', 'insurance', 'other'
  posting_location: string; // 'public' | 'members' | 'homepage'
  posting_deadline_days: number | null;
  retention_years: number;
  requires_annual_update: number; // 0 or 1
  is_repeating: number; // 0 or 1
  sort_order: number;
}

export interface ComplianceDocument {
  id: string; // e.g., 'cdoc_abc123'
  requirement_id: string; // FK to ComplianceRequirement
  title: string;
  file_key: string | null; // R2 path
  file_url: string | null; // External URL
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string; // Email
  uploaded_at: string; // ISO 8601
  document_date: string | null; // Date of document itself
  effective_from: string | null;
  effective_until: string | null;
  is_current: number; // 0 or 1
  visibility: string; // 'public' | 'members'
  notes: string | null;
}

export interface ComplianceAuditLog {
  id: string; // e.g., 'clog_xyz789'
  requirement_id: string | null;
  document_id: string | null;
  action: string; // 'DOCUMENT_UPLOADED', 'DOCUMENT_REPLACED', 'DOCUMENT_ARCHIVED', etc.
  actor_email: string;
  metadata: string | null; // JSON
  created_at: string; // ISO 8601
}

export type ComplianceStatus = 'COMPLIANT' | 'PARTIAL' | 'MISSING' | 'NOT_APPLICABLE';

export interface RequirementStatus {
  requirement: ComplianceRequirement;
  status: ComplianceStatus;
  document: ComplianceDocument | null;
  lastUpdated: string | null;
}

export interface ComplianceStatusSummary {
  score: number; // Percentage (0-100)
  compliantCount: number;
  partialCount: number;
  missingCount: number;
  notApplicableCount: number;
  totalCount: number;
  statuses: RequirementStatus[];
}

// ========== HELPER FUNCTIONS ==========

/** Generate random ID with prefix */
function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${id}`;
}

/** Get current ISO timestamp */
function nowISO(): string {
  return new Date().toISOString();
}

// ========== COMPLIANCE REQUIREMENTS ==========

/** List all compliance requirements (sorted by sort_order) */
export async function listComplianceRequirements(db: D1Database): Promise<ComplianceRequirement[]> {
  const { results } = await db
    .prepare(
      `SELECT id, statute_ref, title, description, category, posting_location,
              posting_deadline_days, retention_years, requires_annual_update,
              is_repeating, sort_order
       FROM compliance_requirements
       ORDER BY sort_order ASC`
    )
    .all<ComplianceRequirement>();
  return results ?? [];
}

/** Get one requirement by ID */
export async function getComplianceRequirement(
  db: D1Database,
  id: string
): Promise<ComplianceRequirement | null> {
  return db
    .prepare(
      `SELECT id, statute_ref, title, description, category, posting_location,
              posting_deadline_days, retention_years, requires_annual_update,
              is_repeating, sort_order
       FROM compliance_requirements
       WHERE id = ?
       LIMIT 1`
    )
    .bind(id)
    .first<ComplianceRequirement>();
}

/** List requirements by category */
export async function listComplianceRequirementsByCategory(
  db: D1Database,
  category: string
): Promise<ComplianceRequirement[]> {
  const { results } = await db
    .prepare(
      `SELECT id, statute_ref, title, description, category, posting_location,
              posting_deadline_days, retention_years, requires_annual_update,
              is_repeating, sort_order
       FROM compliance_requirements
       WHERE category = ?
       ORDER BY sort_order ASC`
    )
    .bind(category)
    .all<ComplianceRequirement>();
  return results ?? [];
}

// ========== COMPLIANCE DOCUMENTS ==========

/** List all compliance documents (optionally filtered by requirement) */
export async function listComplianceDocuments(
  db: D1Database,
  requirementId?: string
): Promise<ComplianceDocument[]> {
  if (requirementId) {
    const { results } = await db
      .prepare(
        `SELECT id, requirement_id, title, file_key, file_url, file_size, mime_type,
                uploaded_by, uploaded_at, document_date, effective_from, effective_until,
                is_current, visibility, notes
         FROM compliance_documents
         WHERE requirement_id = ?
         ORDER BY uploaded_at DESC`
      )
      .bind(requirementId)
      .all<ComplianceDocument>();
    return results ?? [];
  } else {
    const { results } = await db
      .prepare(
        `SELECT id, requirement_id, title, file_key, file_url, file_size, mime_type,
                uploaded_by, uploaded_at, document_date, effective_from, effective_until,
                is_current, visibility, notes
         FROM compliance_documents
         ORDER BY uploaded_at DESC`
      )
      .all<ComplianceDocument>();
    return results ?? [];
  }
}

/** Get current document for a requirement (is_current = 1) */
export async function getCurrentComplianceDocument(
  db: D1Database,
  requirementId: string
): Promise<ComplianceDocument | null> {
  return db
    .prepare(
      `SELECT id, requirement_id, title, file_key, file_url, file_size, mime_type,
              uploaded_by, uploaded_at, document_date, effective_from, effective_until,
              is_current, visibility, notes
       FROM compliance_documents
       WHERE requirement_id = ? AND is_current = 1
       ORDER BY uploaded_at DESC
       LIMIT 1`
    )
    .bind(requirementId)
    .first<ComplianceDocument>();
}

/** Get one compliance document by ID */
export async function getComplianceDocument(
  db: D1Database,
  id: string
): Promise<ComplianceDocument | null> {
  return db
    .prepare(
      `SELECT id, requirement_id, title, file_key, file_url, file_size, mime_type,
              uploaded_by, uploaded_at, document_date, effective_from, effective_until,
              is_current, visibility, notes
       FROM compliance_documents
       WHERE id = ?
       LIMIT 1`
    )
    .bind(id)
    .first<ComplianceDocument>();
}

/** Get compliance document by file_key (for file serving access control) */
export async function getComplianceDocumentByFileKey(
  db: D1Database,
  fileKey: string
): Promise<ComplianceDocument | null> {
  return db
    .prepare(
      `SELECT id, requirement_id, title, file_key, file_url, file_size, mime_type,
              uploaded_by, uploaded_at, document_date, effective_from, effective_until,
              is_current, visibility, notes
       FROM compliance_documents
       WHERE file_key = ?
       LIMIT 1`
    )
    .bind(fileKey)
    .first<ComplianceDocument>();
}

/** Insert new compliance document */
export async function insertComplianceDocument(
  db: D1Database,
  data: {
    requirementId: string;
    title: string;
    fileKey?: string;
    fileUrl?: string;
    fileSize?: number;
    mimeType?: string;
    uploadedBy: string;
    documentDate?: string;
    visibility?: string;
    notes?: string;
  }
): Promise<string> {
  const id = generateId('cdoc');
  const now = nowISO();

  await db
    .prepare(
      `INSERT INTO compliance_documents
       (id, requirement_id, title, file_key, file_url, file_size, mime_type,
        uploaded_by, uploaded_at, document_date, effective_from, is_current, visibility, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(
      id,
      data.requirementId,
      data.title,
      data.fileKey ?? null,
      data.fileUrl ?? null,
      data.fileSize ?? null,
      data.mimeType ?? null,
      data.uploadedBy,
      now,
      data.documentDate ?? null,
      now, // effective_from
      data.visibility ?? 'members',
      data.notes ?? null
    )
    .run();

  return id;
}

/** Archive old document (set is_current = 0, effective_until = now) */
export async function archiveComplianceDocument(db: D1Database, id: string): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      `UPDATE compliance_documents
       SET is_current = 0, effective_until = ?
       WHERE id = ?`
    )
    .bind(now, id)
    .run();
}

/** Archive all current documents for a requirement (before uploading new one) */
export async function archiveCurrentDocumentsForRequirement(
  db: D1Database,
  requirementId: string
): Promise<void> {
  const now = nowISO();
  await db
    .prepare(
      `UPDATE compliance_documents
       SET is_current = 0, effective_until = ?
       WHERE requirement_id = ? AND is_current = 1`
    )
    .bind(now, requirementId)
    .run();
}

// ========== COMPLIANCE AUDIT LOG ==========

/** Insert audit log entry */
export async function insertComplianceAuditLog(
  db: D1Database,
  data: {
    requirementId?: string;
    documentId?: string;
    action: string;
    actorEmail: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const id = generateId('clog');
  const now = nowISO();

  await db
    .prepare(
      `INSERT INTO compliance_audit_log
       (id, requirement_id, document_id, action, actor_email, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      data.requirementId ?? null,
      data.documentId ?? null,
      data.action,
      data.actorEmail,
      data.metadata ? JSON.stringify(data.metadata) : null,
      now
    )
    .run();

  return id;
}

/** List audit logs (optionally filtered by requirement or document) */
export async function listComplianceAuditLogs(
  db: D1Database,
  requirementId?: string,
  documentId?: string,
  limit = 100
): Promise<ComplianceAuditLog[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));

  if (requirementId) {
    const { results } = await db
      .prepare(
        `SELECT id, requirement_id, document_id, action, actor_email, metadata, created_at
         FROM compliance_audit_log
         WHERE requirement_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(requirementId, safeLimit)
      .all<ComplianceAuditLog>();
    return results ?? [];
  } else if (documentId) {
    const { results } = await db
      .prepare(
        `SELECT id, requirement_id, document_id, action, actor_email, metadata, created_at
         FROM compliance_audit_log
         WHERE document_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(documentId, safeLimit)
      .all<ComplianceAuditLog>();
    return results ?? [];
  } else {
    const { results } = await db
      .prepare(
        `SELECT id, requirement_id, document_id, action, actor_email, metadata, created_at
         FROM compliance_audit_log
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(safeLimit)
      .all<ComplianceAuditLog>();
    return results ?? [];
  }
}

// ========== STATUS COMPUTATION ==========

/** Determine status for a single requirement based on its current document */
function determineStatus(req: ComplianceRequirement, doc: ComplianceDocument | null): ComplianceStatus {
  if (!doc) {
    return 'MISSING';
  }

  // If requires annual update, check document_date year
  if (req.requires_annual_update) {
    const currentYear = new Date().getFullYear();
    const docYear = doc.document_date ? new Date(doc.document_date).getFullYear() : 0;
    if (docYear < currentYear) {
      return 'PARTIAL';
    }
  }

  return 'COMPLIANT';
}

/** Get compliance status for all requirements */
export async function getComplianceStatus(db: D1Database): Promise<ComplianceStatusSummary> {
  // 1. Fetch all requirements
  const requirements = await listComplianceRequirements(db);

  // 2. For each requirement, check if current document exists
  const statuses: RequirementStatus[] = await Promise.all(
    requirements.map(async (req) => {
      const doc = await getCurrentComplianceDocument(db, req.id);
      return {
        requirement: req,
        status: determineStatus(req, doc),
        document: doc,
        lastUpdated: doc?.uploaded_at ?? null,
      };
    })
  );

  // 3. Calculate counts
  const compliantCount = statuses.filter((s) => s.status === 'COMPLIANT').length;
  const partialCount = statuses.filter((s) => s.status === 'PARTIAL').length;
  const missingCount = statuses.filter((s) => s.status === 'MISSING').length;
  const notApplicableCount = statuses.filter((s) => s.status === 'NOT_APPLICABLE').length;
  const totalCount = statuses.filter((s) => s.status !== 'NOT_APPLICABLE').length;

  // 4. Calculate score
  const score = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;

  return {
    score,
    compliantCount,
    partialCount,
    missingCount,
    notApplicableCount,
    totalCount,
    statuses,
  };
}

/** Get status for a single requirement */
export async function getRequirementStatus(
  db: D1Database,
  requirementId: string
): Promise<RequirementStatus | null> {
  const req = await getComplianceRequirement(db, requirementId);
  if (!req) return null;

  const doc = await getCurrentComplianceDocument(db, requirementId);
  return {
    requirement: req,
    status: determineStatus(req, doc),
    document: doc,
    lastUpdated: doc?.uploaded_at ?? null,
  };
}
