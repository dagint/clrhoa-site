-- Add notes fields to ARB requests. Run after schema-arb.sql.
-- npm run db:arb:migrate-v6:local or db:arb:migrate-v6 (remote)

ALTER TABLE arb_requests ADD COLUMN arb_internal_notes TEXT;
ALTER TABLE arb_requests ADD COLUMN owner_notes TEXT;
