-- One primary directory entry per property (address). Used for dues/assessments: one assessment per address.
-- Run: npm run db:owners-primary (remote) or db:owners-primary:local
-- Then set is_primary = 1 for exactly one owner per address (board can manage in directory).

ALTER TABLE owners ADD COLUMN is_primary INTEGER DEFAULT 1;
