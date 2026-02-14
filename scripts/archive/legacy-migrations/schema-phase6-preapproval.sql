-- Phase 6: Architectural Pre-Approval Library.
-- Run: wrangler d1 execute DB --local --file=scripts/schema-phase6-preapproval.sql (or without --local for remote)

CREATE TABLE IF NOT EXISTS preapproval_items (
  id TEXT PRIMARY KEY,
  category TEXT,
  title TEXT,
  description TEXT,
  rules TEXT,
  photos JSON,
  created_by TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_preapproval_category ON preapproval_items(category);
CREATE INDEX IF NOT EXISTS idx_preapproval_created ON preapproval_items(created DESC);
