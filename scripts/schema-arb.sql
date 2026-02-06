-- Phase 2: ARB request workflow. Run after schema.sql.
-- npm run db:init:local then: wrangler d1 execute clrhoa_db --local --file=./scripts/schema-arb.sql
-- For remote: wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-arb.sql

CREATE TABLE IF NOT EXISTS arb_requests (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  applicant_name TEXT,
  phone TEXT,
  property_address TEXT,
  application_type TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  esign_timestamp DATETIME,
  arb_esign TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS arb_files (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  r2_keys TEXT NOT NULL,
  original_size INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arb_requests_owner ON arb_requests(owner_email);
CREATE INDEX IF NOT EXISTS idx_arb_requests_status ON arb_requests(status);
CREATE INDEX IF NOT EXISTS idx_arb_files_request ON arb_files(request_id);
