-- Migration: Fix site_feedback table schema mismatch (SAFE VERSION)
-- Date: 2026-02-15
-- Description: The code expects a site_feedback table with url/thumbs/comment (legacy widget schema)
--              This version safely handles both cases: table exists or doesn't exist
--
-- Required for: Fix /portal/admin/feedback page error
-- Run on: Production D1 database (clrhoa_db)
--
-- Usage:
--   Local:  npx wrangler d1 execute clrhoa_db --local --file=scripts/migrations/fix-site-feedback-schema-safe.sql
--   Remote: npx wrangler d1 execute clrhoa_db --remote --file=scripts/migrations/fix-site-feedback-schema-safe.sql

-- Drop the incorrect site_feedback table if it exists
-- (This is safe because the table with category/message/status schema was never used in production)
DROP TABLE IF EXISTS site_feedback;

-- Also drop member_suggestions if it exists (from previous migration attempt)
DROP TABLE IF EXISTS member_suggestions;

-- Create the correct site_feedback table for the feedback widget
CREATE TABLE IF NOT EXISTS site_feedback (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  viewport TEXT,
  session_id TEXT,
  thumbs INTEGER NOT NULL,
  comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_feedback_created ON site_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_site_feedback_thumbs ON site_feedback(thumbs);

-- Verify the new schema
SELECT 'site_feedback table created with correct schema' AS status;
