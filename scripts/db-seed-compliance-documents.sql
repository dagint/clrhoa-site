-- Seed compliance_documents from existing public_documents.
-- Idempotent: INSERT OR IGNORE with stable IDs prevents duplicates.
--
-- This satisfies FL §720.303(4)(b)1.a for bylaws (HOA-02) and covenants (HOA-03)
-- using the files already stored in R2 from the public documents upload flow.
-- Run: npm run db:seed-compliance-docs
--      npm run db:seed-compliance-docs:local

INSERT OR IGNORE INTO compliance_documents
  (id, requirement_id, title, file_key, file_url, file_size, mime_type,
   uploaded_by, uploaded_at, document_date, effective_from, is_current, visibility, notes)
SELECT
  'cdoc_seed_' || pd.slug,
  CASE pd.slug
    WHEN 'bylaws'    THEN 'HOA-02'
    WHEN 'covenants' THEN 'HOA-03'
  END AS requirement_id,
  pd.title,
  pd.file_key,
  NULL,                    -- file_url (served from R2 via portal, not external URL)
  NULL,                    -- file_size (unknown at seed time)
  'application/pdf',
  'system',                -- uploaded_by
  datetime('now'),         -- uploaded_at
  NULL,                    -- document_date (unknown at seed time)
  datetime('now'),         -- effective_from
  1,                       -- is_current
  'public',                -- visibility
  'Seeded from public_documents at compliance initialization'
FROM public_documents pd
WHERE pd.slug IN ('bylaws', 'covenants')
  AND pd.file_key IS NOT NULL;
