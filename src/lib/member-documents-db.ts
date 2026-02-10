/**
 * D1 helpers for member-only documents (minutes, budgets, other).
 * Board uploads; files in R2 under member-docs/; members view on /portal/documents.
 */

export const MEMBER_DOC_CATEGORIES = ['minutes', 'budgets', 'other'] as const;
export type MemberDocCategory = (typeof MEMBER_DOC_CATEGORIES)[number];

export const MEMBER_DOC_CATEGORY_LABELS: Record<MemberDocCategory, string> = {
  minutes: 'Minutes (redacted)',
  budgets: 'Budgets',
  other: 'Other',
};

export interface MemberDocumentRow {
  id: number;
  category: string;
  title: string;
  file_key: string;
  content_type: string | null;
  uploaded_at: string | null;
  uploaded_by_email: string | null;
}

export function isMemberDocCategory(s: string): s is MemberDocCategory {
  return MEMBER_DOC_CATEGORIES.includes(s as MemberDocCategory);
}

/** List all member documents, newest first (for board admin and portal). */
export async function listMemberDocuments(db: D1Database, limit = 500, offset = 0): Promise<MemberDocumentRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const safeOffset = Math.max(0, offset);
  const { results } = await db
    .prepare(
      `SELECT id, category, title, file_key, content_type, uploaded_at, uploaded_by_email
       FROM member_documents ORDER BY category, uploaded_at DESC LIMIT ? OFFSET ?`
    )
    .bind(safeLimit, safeOffset)
    .all<MemberDocumentRow>();
  return results ?? [];
}

/** Get one by id (for delete and file serve). */
export async function getMemberDocument(db: D1Database, id: number): Promise<MemberDocumentRow | null> {
  return db
    .prepare(
      `SELECT id, category, title, file_key, content_type, uploaded_at, uploaded_by_email
       FROM member_documents WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first<MemberDocumentRow>();
}

/** Get one by file_key (for access control: only serve keys that exist in the table). */
export async function getMemberDocumentByFileKey(
  db: D1Database,
  fileKey: string
): Promise<MemberDocumentRow | null> {
  return db
    .prepare(
      `SELECT id, category, title, file_key, content_type, uploaded_at, uploaded_by_email
       FROM member_documents WHERE file_key = ? LIMIT 1`
    )
    .bind(fileKey)
    .first<MemberDocumentRow>();
}

/** Insert after upload. */
export async function insertMemberDocument(
  db: D1Database,
  category: MemberDocCategory,
  title: string,
  fileKey: string,
  contentType: string,
  uploadedByEmail: string
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO member_documents (category, title, file_key, content_type, uploaded_by_email)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(category, title, fileKey, contentType, uploadedByEmail)
    .run();
  return result.meta.last_row_id ?? 0;
}

/** Delete by id (board only). */
export async function deleteMemberDocument(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM member_documents WHERE id = ?`).bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}
