-- Phase 5: Assessments (view-only) + Document Feedback.
-- Run: npm run db:phase5:local or db:phase5 (remote)

-- Assessments: balance, next due, invoice (view-only; no payment processing)
CREATE TABLE IF NOT EXISTS assessments (
  owner_email TEXT PRIMARY KEY,
  balance REAL DEFAULT 0,
  next_due TEXT,
  paid_through TEXT,
  last_payment TEXT,
  invoice_r2_key TEXT,
  updated TEXT DEFAULT (datetime('now'))
);

-- Payment history for last 12 months display
CREATE TABLE IF NOT EXISTS assessment_payments (
  id TEXT PRIMARY KEY,
  owner_email TEXT,
  paid_at TEXT,
  amount REAL,
  balance_after REAL,
  created TEXT DEFAULT (datetime('now'))
);

-- Feedback documents (board uploads)
CREATE TABLE IF NOT EXISTS feedback_docs (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  r2_key TEXT,
  deadline TEXT,
  created_by TEXT,
  created TEXT DEFAULT (datetime('now'))
);

-- Owner responses to feedback docs
CREATE TABLE IF NOT EXISTS feedback_responses (
  doc_id TEXT,
  owner_email TEXT,
  acknowledged INTEGER DEFAULT 0,
  approved INTEGER,
  comments TEXT,
  responded TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(doc_id, owner_email),
  FOREIGN KEY(doc_id) REFERENCES feedback_docs(id)
);
