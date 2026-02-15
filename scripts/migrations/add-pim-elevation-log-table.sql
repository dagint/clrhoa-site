-- Migration: Add pim_elevation_log table for PIM/JIT elevation audit
-- Date: 2026-02-15
-- Description: Creates the pim_elevation_log table to track who elevated when and when it expires.
--              This table is used by the PIM (Privileged Identity Management) system to audit
--              elevation requests and drops for admin/board/ARB users.
--
-- Required for: Issue #110 - PIM elevation flow
-- Run on: Production D1 database (clrhoa_db)
--
-- Usage:
--   Local:  wrangler d1 execute clrhoa_db --local --file=scripts/migrations/add-pim-elevation-log-table.sql
--   Remote: wrangler d1 execute clrhoa_db --remote --file=scripts/migrations/add-pim-elevation-log-table.sql

-- Create pim_elevation_log table
CREATE TABLE IF NOT EXISTS pim_elevation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,                          -- 'elevate' or 'drop'
  elevated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT                                -- ISO timestamp for when elevation expires (NULL for 'drop' action)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pim_elevation_email ON pim_elevation_log(email);
CREATE INDEX IF NOT EXISTS idx_pim_elevation_at ON pim_elevation_log(elevated_at);

-- Verify table was created
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='pim_elevation_log';
