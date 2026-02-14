-- Florida HOA Compliance Documents Table
-- Tracks all documents uploaded to fulfill compliance requirements
-- Supports versioning (multiple docs per requirement over time)

CREATE TABLE IF NOT EXISTS compliance_documents (
  id TEXT PRIMARY KEY,                    -- e.g., 'cdoc_abc123def456'
  requirement_id TEXT NOT NULL,           -- FK to compliance_requirements.id
  title TEXT NOT NULL,
  file_key TEXT,                          -- R2 path (compliance/HOA-01/2026/uuid.pdf)
  file_url TEXT,                          -- If externally hosted
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT NOT NULL,              -- Email
  uploaded_at TEXT NOT NULL,              -- ISO 8601
  document_date TEXT,                     -- Date of document itself
  effective_from TEXT,                    -- When this version became active
  effective_until TEXT,                   -- NULL if current, date if superseded
  is_current INTEGER DEFAULT 1,           -- 1 = active, 0 = archived
  visibility TEXT DEFAULT 'members',      -- 'public' or 'members'
  notes TEXT,

  FOREIGN KEY (requirement_id) REFERENCES compliance_requirements(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_requirement
  ON compliance_documents(requirement_id);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_current
  ON compliance_documents(is_current);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_uploaded
  ON compliance_documents(uploaded_at DESC);
