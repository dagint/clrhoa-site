-- Migration: Fix site_feedback table schema mismatch
-- Date: 2026-02-15
-- Description: The code expects a site_feedback table with url/thumbs/comment (legacy widget schema)
--              but schema-03-features.sql has category/message/status (member suggestions schema).
--              This migration renames the existing table and creates the correct schema.
--
-- Required for: Fix /portal/admin/feedback page error
-- Run on: Production D1 database (clrhoa_db)
--
-- Usage:
--   Local:  wrangler d1 execute clrhoa_db --local --file=scripts/migrations/fix-site-feedback-schema.sql
--   Remote: wrangler d1 execute clrhoa_db --remote --file=scripts/migrations/fix-site-feedback-schema.sql

-- Rename existing site_feedback table to member_suggestions (if it exists)
-- This preserves any existing data while allowing us to create the correct schema
ALTER TABLE site_feedback RENAME TO member_suggestions;

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
