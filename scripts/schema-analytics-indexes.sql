-- Analytics Performance Optimization Indexes
-- Adds composite indexes to improve query performance and prevent full table scans
--
-- Run with:
-- Local:  npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-analytics-indexes.sql
-- Remote: npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-analytics-indexes.sql

-- Composite index for signature analytics queries with date range filters
-- Supports queries filtering by created_at, document_type, and event_type
CREATE INDEX IF NOT EXISTS idx_signature_analytics_created_type_doc
  ON signature_analytics(created_at, event_type, document_type);

-- Index for ARB analytics queries with date range and event type filters
-- Supports queries filtering by created_at and event_type with aggregations
CREATE INDEX IF NOT EXISTS idx_arb_analytics_created_event
  ON arb_analytics(created_at, event_type);

-- Partial index for ARB reviewer statistics (excludes NULL reviewer_email)
-- Supports "top reviewers" queries efficiently
CREATE INDEX IF NOT EXISTS idx_arb_analytics_reviewer
  ON arb_analytics(reviewer_email, created_at, event_type)
  WHERE reviewer_email IS NOT NULL;

-- Note: Queries using date(created_at) cannot use these indexes.
-- Consider storing a separate date column if performance becomes an issue.
-- For now, the composite indexes will help with range queries on created_at.
