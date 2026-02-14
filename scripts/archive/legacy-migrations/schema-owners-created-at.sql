-- Add created_at to owners for "new directory members" notices.
-- Run: npm run db:owners-created-at:local or db:owners-created-at (remote)
-- Idempotent: safe to run multiple times.
-- SQLite does not allow DEFAULT CURRENT_TIMESTAMP in ALTER TABLE; use NULL. App sets created_at on INSERT.

ALTER TABLE owners ADD COLUMN created_at DATETIME DEFAULT NULL;
