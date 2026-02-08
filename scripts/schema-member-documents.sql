-- Member-only documents (redacted minutes, budgets, other) uploaded by Board.
-- Files stored in R2 under member-docs/; metadata here. Members view by category on /portal/documents.
-- Run: npm run db:member-documents:local or db:member-documents (remote)

CREATE TABLE IF NOT EXISTS member_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  file_key TEXT NOT NULL,
  content_type TEXT,
  uploaded_at DATETIME DEFAULT (datetime('now')),
  uploaded_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_documents_category ON member_documents(category);
CREATE INDEX IF NOT EXISTS idx_member_documents_uploaded_at ON member_documents(uploaded_at DESC);
