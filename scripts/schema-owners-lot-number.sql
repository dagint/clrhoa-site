-- Add lot_number to owners (1-25; required for elevated role).
-- Run: npm run db:owners-lot-number:local or db:owners-lot-number (remote)

ALTER TABLE owners ADD COLUMN lot_number TEXT;
