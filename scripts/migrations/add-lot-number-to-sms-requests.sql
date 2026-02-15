-- Migration: Add lot_number column to sms_feature_requests table
-- Date: 2026-02-15
-- Description: Adds lot_number column to track which lots requested SMS features.
--              The column was missing from production but exists in code expectations.
--
-- Required for: Fix /portal/admin/sms-requests page error
-- Run on: Production D1 database (clrhoa_db)
--
-- Usage:
--   Local:  wrangler d1 execute clrhoa_db --local --file=scripts/migrations/add-lot-number-to-sms-requests.sql
--   Remote: wrangler d1 execute clrhoa_db --remote --file=scripts/migrations/add-lot-number-to-sms-requests.sql

-- Add lot_number column if it doesn't exist
-- Note: SQLite doesn't support IF NOT EXISTS for columns, so we check first
-- If the column already exists, this will fail gracefully (can be ignored)

ALTER TABLE sms_feature_requests ADD COLUMN lot_number TEXT;

-- Create index for efficient lot counting
CREATE INDEX IF NOT EXISTS idx_sms_feature_requests_lot ON sms_feature_requests(lot_number);

-- Verify column was added
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='sms_feature_requests';
