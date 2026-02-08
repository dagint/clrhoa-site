-- Add fields to match CLR-ARB-Request-Form-2026. Run once if you already have arb_requests.
-- New installs: use schema-arb.sql which includes these columns.

ALTER TABLE arb_requests ADD COLUMN applicant_name TEXT;
ALTER TABLE arb_requests ADD COLUMN phone TEXT;
ALTER TABLE arb_requests ADD COLUMN property_address TEXT;
ALTER TABLE arb_requests ADD COLUMN application_type TEXT;
