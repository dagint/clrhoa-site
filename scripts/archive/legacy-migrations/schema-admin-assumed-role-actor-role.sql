-- Add actor_role to admin_assumed_role_audit (admin vs arb_board). Run after schema-admin-assumed-role.
-- Run: wrangler d1 execute clrhoa_db --local --file=./scripts/schema-admin-assumed-role-actor-role.sql

ALTER TABLE admin_assumed_role_audit ADD COLUMN actor_role TEXT;
