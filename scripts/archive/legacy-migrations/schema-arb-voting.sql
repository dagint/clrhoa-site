-- ARB Multi-Stage Voting Workflow Schema
-- Phase 1: Voting tables and workflow version tracking
-- Run after schema-arb.sql and schema-arb-audit.sql
--
-- Local: wrangler d1 execute clrhoa_db --local --file=./scripts/schema-arb-voting.sql
-- Remote: wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-arb-voting.sql

-- ============================================================================
-- Step 1: Add workflow version and multi-stage tracking to arb_requests
-- ============================================================================

-- Add workflow_version column (1 = legacy single-reviewer, 2 = multi-stage voting)
ALTER TABLE arb_requests ADD COLUMN workflow_version INTEGER DEFAULT 1;

-- Add current_stage column for multi-stage workflow tracking
-- Possible values: DRAFT, SUBMITTED, ARC_REVIEW, ARC_APPROVED, ARC_DENIED, ARC_RETURNED,
--                  BOARD_REVIEW, BOARD_APPROVED, BOARD_DENIED, BOARD_RETURNED
ALTER TABLE arb_requests ADD COLUMN current_stage TEXT DEFAULT NULL;

-- Add current_cycle column to track revision cycles (increments on resubmission)
ALTER TABLE arb_requests ADD COLUMN current_cycle INTEGER DEFAULT 1;

-- Add submitted_at timestamp (starts 30-day deadline clock)
ALTER TABLE arb_requests ADD COLUMN submitted_at DATETIME DEFAULT NULL;

-- Add resolved_at timestamp (when final decision made)
ALTER TABLE arb_requests ADD COLUMN resolved_at DATETIME DEFAULT NULL;

-- Add auto_approved_reason (e.g., 'deadline_expired' if auto-approved)
ALTER TABLE arb_requests ADD COLUMN auto_approved_reason TEXT DEFAULT NULL;

-- Add deadline_date (submitted_at + 30 days, calculated for convenience)
ALTER TABLE arb_requests ADD COLUMN deadline_date DATETIME DEFAULT NULL;

-- ============================================================================
-- Step 2: Create arc_request_votes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS arc_request_votes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  voter_email TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('ARC_REVIEW', 'BOARD_REVIEW')),
  vote TEXT NOT NULL CHECK (vote IN ('APPROVE', 'DENY', 'RETURN', 'ABSTAIN')),
  comment TEXT,
  voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  cycle INTEGER DEFAULT 1 NOT NULL,
  FOREIGN KEY (request_id) REFERENCES arb_requests(id),
  UNIQUE(request_id, voter_email, stage, cycle)
);

-- ============================================================================
-- Step 3: Create indexes for performance
-- ============================================================================

-- Index for finding votes by request and stage
CREATE INDEX IF NOT EXISTS idx_arc_votes_request_stage
  ON arc_request_votes(request_id, stage, cycle);

-- Index for finding votes by voter (for recusal checks)
CREATE INDEX IF NOT EXISTS idx_arc_votes_voter
  ON arc_request_votes(voter_email);

-- Index for finding votes by stage (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_arc_votes_stage
  ON arc_request_votes(stage);

-- Index for workflow_version on arb_requests (for filtering v1 vs v2)
CREATE INDEX IF NOT EXISTS idx_arb_requests_workflow_version
  ON arb_requests(workflow_version);

-- Index for current_stage on arb_requests (for dashboard filtering)
CREATE INDEX IF NOT EXISTS idx_arb_requests_current_stage
  ON arb_requests(current_stage);

-- Index for deadline tracking (find requests approaching deadline)
CREATE INDEX IF NOT EXISTS idx_arb_requests_deadline
  ON arb_requests(deadline_date);

-- ============================================================================
-- Step 4: Add cycle column to arb_audit_log for tracking revision cycles
-- ============================================================================

ALTER TABLE arb_audit_log ADD COLUMN cycle INTEGER DEFAULT 1;

-- Add metadata column for storing JSON data (e.g., vote details)
ALTER TABLE arb_audit_log ADD COLUMN metadata TEXT DEFAULT NULL;

-- ============================================================================
-- Step 5: Mark existing requests as legacy workflow (v1)
-- ============================================================================

-- Set workflow_version=1 for all existing requests to preserve legacy behavior
UPDATE arb_requests
SET workflow_version = 1
WHERE workflow_version IS NULL;

-- Migration complete!
-- Existing requests will continue to use the legacy single-reviewer workflow.
-- New requests can be created with workflow_version=2 to use multi-stage voting.
