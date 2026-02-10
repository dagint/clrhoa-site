-- Performance indexes for directory and ARB tables
-- Run: npm run db:migrate:performance (or wrangler d1 execute clrhoa_db --file=./scripts/schema-indexes-performance.sql --remote)
--
-- These indexes improve query performance for:
-- 1. Directory address lookups (listEmailsAtSameAddress)
-- 2. Directory name sorting (listOwners ORDER BY name)
-- 3. ARB request sequence lookups (getNextArbRequestId)

-- Owners table indexes
CREATE INDEX IF NOT EXISTS idx_owners_address ON owners(address);
CREATE INDEX IF NOT EXISTS idx_owners_name ON owners(name);

-- ARB requests compound index for sequence lookups and status filtering
CREATE INDEX IF NOT EXISTS idx_arb_requests_created_status ON arb_requests(created, status);

-- ARB requests index for ID prefix searches (ARB-YYYY-NNNN pattern)
CREATE INDEX IF NOT EXISTS idx_arb_requests_id_prefix ON arb_requests(id);
