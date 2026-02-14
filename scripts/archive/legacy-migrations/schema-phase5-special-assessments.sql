-- Special assessments (one-off bills). Run after schema-phase5.
-- npm run db:phase5-special-assessments:local or db:phase5-special-assessments (remote)

CREATE TABLE IF NOT EXISTS special_assessments (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT,
  paid_at TEXT,
  created_by TEXT,
  created TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_special_assessments_owner ON special_assessments(owner_email);
