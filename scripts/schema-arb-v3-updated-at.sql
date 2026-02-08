-- Add updated_at for tracking edits. Run once if you already have arb_requests.
-- Local: wrangler d1 execute clrhoa_db --local --file=./scripts/schema-arb-v3-updated-at.sql
-- Remote: wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-arb-v3-updated-at.sql

ALTER TABLE arb_requests ADD COLUMN updated_at DATETIME;
