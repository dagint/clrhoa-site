/**
 * D1 helpers for public documents (bylaws, covenants, proxy form, ARB request form).
 * When file_key is set, the file is served from R2; otherwise the /documents page uses content collection.
 */

export interface PublicDocumentRow {
  slug: string;
  title: string;
  category: string;
  description: string | null;
  file_key: string | null;
  content_type: string | null;
  effective_date: string | null;
  updated_at: string | null;
  updated_by_email: string | null;
  updated_by_role: string | null;
}

const MANAGED_SLUGS = ['bylaws', 'covenants', 'proxy-form', 'arb-request-form'] as const;
export type PublicDocumentSlug = (typeof MANAGED_SLUGS)[number];

export function isManagedPublicDocSlug(s: string): s is PublicDocumentSlug {
  return MANAGED_SLUGS.includes(s as PublicDocumentSlug);
}

/** Board can update these; ARB cannot. */
export const BOARD_ONLY_SLUGS: PublicDocumentSlug[] = ['bylaws', 'covenants', 'proxy-form'];

/** ARB (or board/admin) can update the ARB request form. */
export const ARB_FORM_SLUG: PublicDocumentSlug = 'arb-request-form';

/** List all managed public documents (for board/ARB admin UI). */
export async function listPublicDocuments(db: D1Database): Promise<PublicDocumentRow[]> {
  const placeholders = MANAGED_SLUGS.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT slug, title, category, description, file_key, content_type, effective_date, updated_at, updated_by_email, updated_by_role
       FROM public_documents WHERE slug IN (${placeholders}) ORDER BY slug`
    )
    .bind(...MANAGED_SLUGS)
    .all<PublicDocumentRow>();
  return results ?? [];
}

/** Get one by slug (for serving file or checking if override exists). */
export async function getPublicDocument(db: D1Database, slug: string): Promise<PublicDocumentRow | null> {
  return db
    .prepare(
      `SELECT slug, title, category, description, file_key, content_type, effective_date, updated_at, updated_by_email, updated_by_role
       FROM public_documents WHERE slug = ? LIMIT 1`
    )
    .bind(slug)
    .first<PublicDocumentRow>();
}

/** Update after upload: set file_key, content_type, updated_at, updated_by. */
export async function setPublicDocumentFile(
  db: D1Database,
  slug: string,
  fileKey: string,
  contentType: string,
  updatedByEmail: string,
  updatedByRole: string,
  effectiveDate?: string | null
): Promise<void> {
  await db
    .prepare(
      `UPDATE public_documents SET file_key = ?, content_type = ?, updated_at = datetime('now'), updated_by_email = ?, updated_by_role = ?, effective_date = COALESCE(?, effective_date) WHERE slug = ?`
    )
    .bind(fileKey, contentType, updatedByEmail, updatedByRole, effectiveDate ?? null, slug)
    .run();
}
