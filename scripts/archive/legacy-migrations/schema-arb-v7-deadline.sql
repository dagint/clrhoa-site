-- Add deadline field to ARB requests. Run after schema-arb.sql.
-- npm run db:arb:migrate-v7:local or db:arb:migrate-v7 (remote)

ALTER TABLE arb_requests ADD COLUMN review_deadline DATETIME;

CREATE INDEX IF NOT EXISTS idx_arb_requests_deadline ON arb_requests(review_deadline);
