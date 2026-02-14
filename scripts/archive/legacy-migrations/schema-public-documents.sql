-- Public documents (bylaws, covenants, proxy form, ARB request form) managed by Board/ARB.
-- When file_key is set, /documents page serves from R2; otherwise uses content collection.
-- Run: npm run db:public-documents:local or db:public-documents (remote)

CREATE TABLE IF NOT EXISTS public_documents (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  file_key TEXT,
  content_type TEXT,
  effective_date TEXT,
  updated_at DATETIME,
  updated_by_email TEXT,
  updated_by_role TEXT
);

-- Seed placeholder rows (no file_key = use content collection until first upload)
INSERT OR IGNORE INTO public_documents (slug, title, category, description, file_key) VALUES
  ('bylaws', 'Bylaws', 'Governing Documents', 'Bylaws including Addendum A. Governs the operation of the HOA.', NULL),
  ('covenants', 'Declaration of Covenants & Restrictions', 'Governing Documents', 'Covenants & Restrictions and Addendums. Governing document for the community.', NULL),
  ('proxy-form', 'Proxy Form', 'Forms', 'Use this form to designate a proxy for HOA votes when you cannot attend a meeting.', NULL),
  ('arb-request-form', 'ARB Request Form', 'Forms', 'Submit this form to request Architectural Review Board (ARB) approval for modifications.', NULL);
