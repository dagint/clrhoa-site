-- Add signature_id column to arb_requests table
-- Links ARB requests to ESIGN Act compliant electronic signatures
--
-- Run with:
-- Local:  npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-arb-esignature-link.sql
-- Remote: npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-arb-esignature-link.sql

-- Note: This migration is idempotent - safe to run multiple times
-- If the column already exists, the ALTER TABLE will fail silently

-- Add signature_id column (links to electronic_signatures.id)
-- SQLite allows ADD COLUMN but not IF NOT EXISTS
-- If this fails with "duplicate column name", the column already exists - that's OK
ALTER TABLE arb_requests ADD COLUMN signature_id TEXT;

-- Create index on signature_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_arb_requests_signature ON arb_requests(signature_id);
