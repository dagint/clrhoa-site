-- Phase 6 add-on: Board approval for pre-approval library items.
-- ARB can add items (approved=0); one Board member approves to make active (approved=1).
-- Run before deploying the library approval workflow:
--   wrangler d1 execute DB --local --file=scripts/schema-phase6-preapproval-approved.sql
--   (omit --local for remote DB)
-- Existing rows get approved=1 so they stay visible in the member library.

ALTER TABLE preapproval_items ADD COLUMN approved INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_preapproval_approved ON preapproval_items(approved);
