-- Analytics & Usage Tracking Schema
-- Tracks signatures, ARB submissions, and other key metrics
--
-- Run with:
-- Local:  npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-analytics.sql
-- Remote: npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-analytics.sql

-- Signature Analytics Events
CREATE TABLE IF NOT EXISTS signature_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,  -- 'created', 'verified', 'viewed', 'revoked'
  signature_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  user_email TEXT,
  actor_email TEXT,  -- Who performed the action (for verified/viewed events)
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signature_analytics_type ON signature_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_signature_analytics_signature ON signature_analytics(signature_id);
CREATE INDEX IF NOT EXISTS idx_signature_analytics_document ON signature_analytics(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_signature_analytics_created ON signature_analytics(created_at DESC);

-- ARB Request Analytics
CREATE TABLE IF NOT EXISTS arb_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,  -- 'submitted', 'approved', 'denied', 'returned', 'cancelled'
  request_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  reviewer_email TEXT,  -- Who approved/denied
  has_signature INTEGER DEFAULT 0,  -- 1 if electronically signed
  signature_id TEXT,
  processing_time_hours REAL,  -- Time from submission to decision
  revision_count INTEGER DEFAULT 0,  -- Number of times returned for revision
  file_count INTEGER DEFAULT 0,  -- Number of attachments
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_arb_analytics_type ON arb_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_arb_analytics_request ON arb_analytics(request_id);
CREATE INDEX IF NOT EXISTS idx_arb_analytics_owner ON arb_analytics(owner_email);
CREATE INDEX IF NOT EXISTS idx_arb_analytics_created ON arb_analytics(created_at DESC);

-- Daily Aggregated Statistics (for performance)
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  metric_type TEXT NOT NULL,  -- 'signatures_created', 'arb_submitted', 'arb_approved', etc.
  count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,  -- JSON for additional data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_type ON daily_stats(metric_type);
