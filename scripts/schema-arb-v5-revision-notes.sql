-- Revision notes: ARB can provide context when returning a request for revision.
-- Run once: npm run db:arb:migrate-v5:local  (or db:arb:migrate-v5 for remote)

ALTER TABLE arb_requests ADD COLUMN revision_notes TEXT;
