-- Track who last updated each owner (board directory edits). For audit.
-- Run: npm run db:owners-updated-by:local or db:owners-updated-by (remote)

ALTER TABLE owners ADD COLUMN updated_by TEXT;
ALTER TABLE owners ADD COLUMN updated_at TEXT;
