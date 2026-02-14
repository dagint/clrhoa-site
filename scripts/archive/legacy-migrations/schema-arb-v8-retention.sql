-- Add deleted_at column for soft deletes and data retention tracking.
-- Run after schema-arb.sql.
-- npm run db:arb:migrate-v8:local or db:arb:migrate-v8 (remote)

ALTER TABLE arb_requests ADD COLUMN deleted_at DATETIME;
CREATE INDEX IF NOT EXISTS idx_arb_requests_deleted ON arb_requests(deleted_at);

-- Add retention tracking columns
ALTER TABLE arb_audit_log ADD COLUMN deleted_at DATETIME;
CREATE INDEX IF NOT EXISTS idx_arb_audit_deleted ON arb_audit_log(deleted_at);
