-- Vendor submissions: members suggest vendors; board/arb/admin approve before they appear.
-- Run after schema-phase3.sql. npm run db:vendor-submissions:local or db:vendor-submissions (remote)

CREATE TABLE IF NOT EXISTS vendor_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  files JSON,
  status TEXT DEFAULT 'pending',
  submitted_by TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  review_notes TEXT,
  created_vendor_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendor_submissions_status ON vendor_submissions(status);
CREATE INDEX IF NOT EXISTS idx_vendor_submissions_submitted_by ON vendor_submissions(submitted_by);
