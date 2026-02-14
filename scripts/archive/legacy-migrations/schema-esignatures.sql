-- Electronic Signatures Table
-- ESIGN Act compliant signature capture for ARB requests, proxy forms, etc.
--
-- Legal Requirements (ESIGN Act):
-- 1. Intent to sign
-- 2. Consent to electronic records
-- 3. Attribution to person signing
-- 4. Association with the record
-- 5. Retention of signature and record
--
-- Local:  npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-esignatures.sql
-- Remote: npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-esignatures.sql

CREATE TABLE IF NOT EXISTS electronic_signatures (
  id TEXT PRIMARY KEY,                    -- e.g., 'esig_abc123'
  document_type TEXT NOT NULL,            -- 'arb_request', 'proxy_form', 'contract', etc.
  document_id TEXT NOT NULL,              -- Foreign key to related document (e.g., arb_request.id)
  signer_email TEXT NOT NULL,             -- Email of person signing
  signer_name TEXT NOT NULL,              -- Full name as typed by signer
  signature_data TEXT NOT NULL,           -- JSON: { typedName, consentGiven, intentStatement }
  ip_address TEXT,                        -- IP address of signer
  user_agent TEXT,                        -- Browser/device information
  signed_at TEXT NOT NULL,                -- ISO 8601 timestamp
  consent_acknowledged INTEGER NOT NULL DEFAULT 1,  -- Signer consented to e-signature
  signature_valid INTEGER NOT NULL DEFAULT 1,       -- Signature is valid (not revoked)
  verification_code TEXT,                 -- Optional verification code for audit
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_esig_document
  ON electronic_signatures(document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_esig_signer
  ON electronic_signatures(signer_email);

CREATE INDEX IF NOT EXISTS idx_esig_signed_at
  ON electronic_signatures(signed_at DESC);

-- E-Signature Audit Log
-- Tracks all signature-related events for compliance
CREATE TABLE IF NOT EXISTS esignature_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature_id TEXT NOT NULL,
  event_type TEXT NOT NULL,               -- 'CREATED', 'VERIFIED', 'REVOKED', 'VIEWED'
  actor_email TEXT,                       -- Who performed the action
  ip_address TEXT,
  details TEXT,                           -- JSON metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_esig_audit_signature
  ON esignature_audit_log(signature_id);

CREATE INDEX IF NOT EXISTS idx_esig_audit_created
  ON esignature_audit_log(created_at DESC);
