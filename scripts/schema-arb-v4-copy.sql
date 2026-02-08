-- Copy-from-completed: allow copying approved/denied requests with pointer-only attachments.
-- copied_from_id: source request id when this request was created by copy.
-- reference_only: 1 = file row is a pointer to R2 objects owned by another request; delete removes only the row, not R2.
-- Run once: wrangler d1 execute clrhoa_db --local --file=./scripts/schema-arb-v4-copy.sql
-- For remote: wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-arb-v4-copy.sql

ALTER TABLE arb_requests ADD COLUMN copied_from_id TEXT;
ALTER TABLE arb_files ADD COLUMN reference_only INTEGER DEFAULT 0;
