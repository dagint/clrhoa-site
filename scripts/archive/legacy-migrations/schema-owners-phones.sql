-- Add multiple phones support to owners. Run after schema-phase3.
-- npm run db:owners-phones:local or db:owners-phones (remote)

-- SQLite 3.35+ supports IF NOT EXISTS for ADD COLUMN
ALTER TABLE owners ADD COLUMN phones TEXT;

-- Backfill: copy single phone into JSON array for existing rows
UPDATE owners SET phones = json_array(phone) WHERE phone IS NOT NULL AND (phones IS NULL OR phones = '');
