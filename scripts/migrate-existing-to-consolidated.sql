-- ============================================================================
-- MIGRATION: Update Existing Tables to Match Consolidated Schema
-- ============================================================================
-- This script adds missing columns to existing tables on remote database
-- Run BEFORE executing consolidated schema files on an existing database
--
-- Usage:
--   npx wrangler d1 execute clrhoa_db --remote --file=./scripts/consolidated/migrate-existing-to-consolidated.sql
--
-- IMPORTANT: This is safe to run multiple times (ALTER TABLE will fail gracefully if column exists)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CORE TABLES (schema-01-core.sql)
-- ----------------------------------------------------------------------------

-- Directory logs: Add missing columns
ALTER TABLE directory_logs ADD COLUMN viewer_role TEXT;
ALTER TABLE directory_logs ADD COLUMN target_email TEXT;
ALTER TABLE directory_logs ADD COLUMN ip_address TEXT;

-- Owners: Add missing phone columns
ALTER TABLE owners ADD COLUMN phone2 TEXT;
ALTER TABLE owners ADD COLUMN phone3 TEXT;

-- ----------------------------------------------------------------------------
-- AUTH & SESSIONS (schema-02-auth-sessions.sql)
-- ----------------------------------------------------------------------------

-- Sessions: Add PIM columns
ALTER TABLE sessions ADD COLUMN elevated_until INTEGER DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN assumed_role TEXT DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN assumed_at INTEGER DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN assumed_until INTEGER DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- FEATURES (schema-03-features.sql)
-- ----------------------------------------------------------------------------

-- ARB Requests: Add v2-v8 columns
ALTER TABLE arb_requests ADD COLUMN applicant_name TEXT;
ALTER TABLE arb_requests ADD COLUMN phone TEXT;
ALTER TABLE arb_requests ADD COLUMN property_address TEXT;
ALTER TABLE arb_requests ADD COLUMN application_type TEXT;
ALTER TABLE arb_requests ADD COLUMN arb_internal_notes TEXT;
ALTER TABLE arb_requests ADD COLUMN owner_notes TEXT;
ALTER TABLE arb_requests ADD COLUMN review_deadline DATETIME;
ALTER TABLE arb_requests ADD COLUMN deleted_at DATETIME;
ALTER TABLE arb_requests ADD COLUMN signature_id TEXT;

-- ARB Requests: Add voting workflow columns
ALTER TABLE arb_requests ADD COLUMN workflow_version INTEGER DEFAULT 1;
ALTER TABLE arb_requests ADD COLUMN current_stage TEXT DEFAULT NULL;
ALTER TABLE arb_requests ADD COLUMN current_cycle INTEGER DEFAULT 1;
ALTER TABLE arb_requests ADD COLUMN submitted_at DATETIME DEFAULT NULL;
ALTER TABLE arb_requests ADD COLUMN resolved_at DATETIME DEFAULT NULL;
ALTER TABLE arb_requests ADD COLUMN auto_approved_reason TEXT DEFAULT NULL;
ALTER TABLE arb_requests ADD COLUMN deadline_date DATETIME DEFAULT NULL;

-- ARB Audit Log: Add missing columns
ALTER TABLE arb_audit_log ADD COLUMN ip_address TEXT;
ALTER TABLE arb_audit_log ADD COLUMN cycle INTEGER DEFAULT 1;
ALTER TABLE arb_audit_log ADD COLUMN metadata TEXT DEFAULT NULL;
ALTER TABLE arb_audit_log ADD COLUMN deleted_at DATETIME;

-- Meetings: Add post_to_public_news
ALTER TABLE meetings ADD COLUMN post_to_public_news INTEGER DEFAULT 0;

-- Assessment Payments: Add missing columns
ALTER TABLE assessment_payments ADD COLUMN paid_through_after TEXT;
ALTER TABLE assessment_payments ADD COLUMN payment_method TEXT DEFAULT 'check';
ALTER TABLE assessment_payments ADD COLUMN recorded_by_email TEXT;

-- Vendors: Add missing columns
ALTER TABLE vendors ADD COLUMN website TEXT;
ALTER TABLE vendors ADD COLUMN show_on_public_site INTEGER DEFAULT 0;

-- Vendor Audit Log: Add IP address
ALTER TABLE vendor_audit_log ADD COLUMN ip_address TEXT;

-- News Items: Add image fields
ALTER TABLE news_items ADD COLUMN image_placement TEXT DEFAULT 'above';
ALTER TABLE news_items ADD COLUMN image_r2_key TEXT;

-- Preapproval Items: Add approved column
ALTER TABLE preapproval_items ADD COLUMN approved INTEGER DEFAULT 0;

-- Vendor Submissions: Add website
ALTER TABLE vendor_submissions ADD COLUMN website TEXT;

-- ----------------------------------------------------------------------------
-- ADMIN & COMPLIANCE (schema-04-admin-compliance.sql)
-- ----------------------------------------------------------------------------

-- Backup Config: Add missing columns
ALTER TABLE backup_config ADD COLUMN google_drive_folder_name TEXT;
ALTER TABLE backup_config ADD COLUMN google_last_backup_at TEXT;
ALTER TABLE backup_config ADD COLUMN last_backup_at TEXT;
ALTER TABLE backup_config ADD COLUMN last_backup_status TEXT;
ALTER TABLE backup_config ADD COLUMN last_backup_error TEXT;

-- ============================================================================
-- Notes
-- ============================================================================
-- Some ALTER TABLE commands will fail with "duplicate column name" if the
-- column already exists. This is expected and safe - SQLite will skip those.
--
-- After running this migration, you can safely run the consolidated schema
-- files which will create any missing tables and indexes.
-- ============================================================================
