-- ============================================================================
-- CONSOLIDATED ADMIN & COMPLIANCE SCHEMA
-- ============================================================================
-- This is the FINAL consolidated schema including ALL incremental migrations.
-- Creates admin and compliance tables including:
-- - RBAC: Route permissions (role-based access control)
-- - Compliance: Florida HOA Statute 720.303(4) tracking
-- - Backups: Backup configuration and tracking
-- - Analytics: Usage metrics and statistics
-- - Admin Logs: PIM elevation, owner contact audit, assumed role tracking
--
-- Usage:
--   npm run wrangler d1 execute clrhoa_db --local --file=./scripts/consolidated/schema-04-admin-compliance.sql
--   npm run wrangler d1 execute clrhoa_db --remote --file=./scripts/consolidated/schema-04-admin-compliance.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Route Permissions (RBAC - Role-Based Access Control)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS route_permissions (
  id TEXT PRIMARY KEY,
  route_path TEXT NOT NULL,
  role TEXT NOT NULL,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('none', 'read', 'write')),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  UNIQUE(route_path, role)
);

CREATE INDEX IF NOT EXISTS idx_route_permissions_path ON route_permissions(route_path);
CREATE INDEX IF NOT EXISTS idx_route_permissions_role ON route_permissions(role);
CREATE INDEX IF NOT EXISTS idx_route_permissions_updated_at ON route_permissions(updated_at);

-- ----------------------------------------------------------------------------
-- Compliance Requirements (Florida HOA Statute 720.303(4))
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id TEXT PRIMARY KEY,                    -- e.g., 'HOA-01', 'HOA-15'
  statute_ref TEXT NOT NULL,              -- e.g., '§720.303(4)(b)1.a'
  title TEXT NOT NULL,                    -- Short title
  description TEXT NOT NULL,              -- Full requirement description
  category TEXT NOT NULL,                 -- 'governing_docs', 'financial', 'meetings', 'contracts', 'insurance', 'other'
  posting_location TEXT NOT NULL,         -- 'public' | 'members' | 'homepage'
  posting_deadline_days INTEGER,          -- NULL for static docs, 14 for meeting notices, etc.
  retention_years INTEGER DEFAULT 7,      -- How long to keep (7 years default, permanent for governing docs)
  requires_annual_update INTEGER DEFAULT 0, -- 1 if needs annual refresh (budgets, financial reports)
  is_repeating INTEGER DEFAULT 0,         -- 1 for meeting notices (recurring requirement)
  sort_order INTEGER DEFAULT 0            -- Display order
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_category ON compliance_requirements(category);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_sort ON compliance_requirements(sort_order);

-- Compliance Documents (tracks uploaded documents for each requirement)
CREATE TABLE IF NOT EXISTS compliance_documents (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_key TEXT,                          -- R2 path (compliance/HOA-01/2026/uuid.pdf)
  file_url TEXT,                          -- If externally hosted
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  document_date TEXT,                     -- Date of document itself
  effective_from TEXT,                    -- When this version became active
  effective_until TEXT,                   -- NULL if current, date if superseded
  is_current INTEGER DEFAULT 1,           -- 1 = active, 0 = archived
  visibility TEXT DEFAULT 'members',      -- 'public' or 'members'
  notes TEXT,
  FOREIGN KEY (requirement_id) REFERENCES compliance_requirements(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_requirement ON compliance_documents(requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_current ON compliance_documents(is_current);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_uploaded ON compliance_documents(uploaded_at DESC);

-- Compliance Audit Log (tracks all compliance-related actions)
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  action_type TEXT NOT NULL,              -- 'document_uploaded', 'requirement_created', 'posting_verified'
  requirement_id TEXT,
  document_id TEXT,
  actor_email TEXT NOT NULL,
  actor_role TEXT,
  details TEXT,                           -- JSON metadata
  ip_address TEXT,
  FOREIGN KEY (requirement_id) REFERENCES compliance_requirements(id),
  FOREIGN KEY (document_id) REFERENCES compliance_documents(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_timestamp ON compliance_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_requirement ON compliance_audit_log(requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_actor ON compliance_audit_log(actor_email);

-- ----------------------------------------------------------------------------
-- Backup Configuration and Tracking
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS backup_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Enforce single row
  google_drive_enabled INTEGER NOT NULL DEFAULT 0,
  google_refresh_token_encrypted TEXT,
  google_drive_folder_id TEXT,
  google_drive_folder_name TEXT,          -- From schema-backup-config-google-last.sql
  google_last_backup_at TEXT,             -- Last successful Google Drive backup
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_hour_utc INTEGER NOT NULL DEFAULT 2,
  schedule_day_of_week INTEGER,
  include_r2_manifest INTEGER NOT NULL DEFAULT 0,
  include_r2_files INTEGER NOT NULL DEFAULT 0,
  last_backup_at TEXT,                    -- From schema-backup-config-last-run.sql
  last_backup_status TEXT,                -- 'success', 'failure', 'in_progress'
  last_backup_error TEXT,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- Analytics & Usage Tracking
-- ----------------------------------------------------------------------------

-- Page Views (usage metrics)
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id);

-- Signature Analytics Events
CREATE TABLE IF NOT EXISTS signature_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,               -- 'created', 'verified', 'viewed', 'revoked'
  signature_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  user_email TEXT,
  actor_email TEXT,                       -- Who performed the action
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signature_analytics_type ON signature_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_signature_analytics_signature ON signature_analytics(signature_id);
CREATE INDEX IF NOT EXISTS idx_signature_analytics_document ON signature_analytics(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_signature_analytics_created ON signature_analytics(created_at DESC);

-- ARB Request Analytics
CREATE TABLE IF NOT EXISTS arb_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,               -- 'submitted', 'approved', 'denied', 'returned', 'cancelled'
  request_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  reviewer_email TEXT,                    -- Who approved/denied
  has_signature INTEGER DEFAULT 0,        -- 1 if electronically signed
  signature_id TEXT,
  processing_time_hours REAL,             -- Time from submission to decision
  revision_count INTEGER DEFAULT 0,       -- Number of times returned for revision
  file_count INTEGER DEFAULT 0,           -- Number of attachments
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_arb_analytics_type ON arb_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_arb_analytics_request ON arb_analytics(request_id);
CREATE INDEX IF NOT EXISTS idx_arb_analytics_owner ON arb_analytics(owner_email);
CREATE INDEX IF NOT EXISTS idx_arb_analytics_created ON arb_analytics(created_at DESC);

-- Daily Aggregated Statistics (for performance)
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                     -- YYYY-MM-DD
  metric_type TEXT NOT NULL,              -- 'signatures_created', 'arb_submitted', 'arb_approved', etc.
  count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,                          -- JSON for additional data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_type ON daily_stats(metric_type);

-- ----------------------------------------------------------------------------
-- Admin Audit Logs (PIM, Owner Contact, Assumed Roles)
-- ----------------------------------------------------------------------------

-- Owner Contact Audit (track when admins/board access owner contact info)
CREATE TABLE IF NOT EXISTS owner_contact_audit_log (
  id TEXT PRIMARY KEY,
  viewer_email TEXT NOT NULL,
  viewer_role TEXT NOT NULL,
  target_owner_id TEXT NOT NULL,
  target_owner_email TEXT,
  contact_type TEXT NOT NULL,             -- 'phone', 'email', 'address'
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_contact_audit_viewer ON owner_contact_audit_log(viewer_email);
CREATE INDEX IF NOT EXISTS idx_owner_contact_audit_target ON owner_contact_audit_log(target_owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_contact_audit_timestamp ON owner_contact_audit_log(timestamp);

-- Assumed Role Audit (track when admins assume board/arb roles)
CREATE TABLE IF NOT EXISTS assumed_role_audit_log (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  base_role TEXT NOT NULL,                -- 'admin' or 'arb_board'
  assumed_role TEXT NOT NULL,             -- 'board' or 'arb'
  actor_role TEXT,                        -- If different from base_role (for tracking)
  assumed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assumed_until DATETIME NOT NULL,
  ended_at DATETIME,
  end_reason TEXT,                        -- 'expired', 'manual_logout', 'revoked'
  ip_address TEXT,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_assumed_role_audit_user ON assumed_role_audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_assumed_role_audit_timestamp ON assumed_role_audit_log(assumed_at);
CREATE INDEX IF NOT EXISTS idx_assumed_role_audit_active ON assumed_role_audit_log(assumed_until);

-- ============================================================================
-- Notes on Admin & Compliance System
-- ============================================================================
-- RBAC (Role-Based Access Control):
--   - Default permissions defined in PROTECTED_ROUTES (src/utils/rbac.ts)
--   - route_permissions table stores admin overrides (optional)
--   - Permission levels: none (403), read (view-only), write (full access)
--   - Middleware enforces access on every request
--
-- Compliance (Florida HOA Statute 720.303(4)):
--   - 15 statutory requirements for document posting
--   - Tracks all uploaded documents with versioning
--   - Supports both R2-hosted and externally-hosted documents
--   - Full audit trail of compliance actions
--   - Automatic deadline tracking and alerts
--
-- Backups:
--   - Automated D1 database backups to Google Drive
--   - Optional R2 manifest and file backups
--   - Configurable schedule (daily, weekly, monthly)
--   - Tracks backup status and errors
--
-- Analytics:
--   - Page view tracking for usage metrics
--   - E-signature event tracking (created, verified, viewed, revoked)
--   - ARB workflow analytics (processing time, revision counts)
--   - Daily aggregated statistics for performance dashboards
--
-- Admin Audit:
--   - Tracks owner contact info access (privacy compliance)
--   - Logs PIM elevation events (privilege escalation)
--   - Records assumed role usage (admin assuming board/arb)
--   - Full IP and timestamp tracking for security
-- ============================================================================
