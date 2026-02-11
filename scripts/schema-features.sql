-- ============================================================================
-- FEATURES SCHEMA: Application Features & Business Logic
-- ============================================================================
-- This script creates all feature-specific tables including:
-- - ARB: Architectural Review Board request workflow
-- - Meetings: Board/ARB meeting scheduling and RSVPs
-- - Maintenance: Common area maintenance requests
-- - Assessments: HOA dues and payment history (view-only)
-- - Feedback: Board-initiated feedback collection
-- - Vendors: Approved vendor directory
--
-- Usage:
--   npm run db:schema:features:local   (local development)
--   npm run db:schema:features         (production)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ARB (Architectural Review Board)
-- ----------------------------------------------------------------------------

-- ARB request submissions
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

CREATE INDEX IF NOT EXISTS idx_arb_requests_owner ON arb_requests(owner_email);
CREATE INDEX IF NOT EXISTS idx_arb_requests_status ON arb_requests(status);
CREATE INDEX IF NOT EXISTS idx_arb_requests_created ON arb_requests(created);

-- ARB file attachments (references R2 storage)
CREATE TABLE IF NOT EXISTS arb_files (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  r2_keys TEXT NOT NULL,
  original_size INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_arb_files_request ON arb_files(request_id);

-- ----------------------------------------------------------------------------
-- Meetings (Board & ARB)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  datetime TEXT,
  location TEXT,
  agenda_r2_key TEXT,
  created_by TEXT,
  created TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_meetings_datetime ON meetings(datetime);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

-- Meeting RSVPs
CREATE TABLE IF NOT EXISTS meeting_rsvps (
  meeting_id TEXT,
  owner_email TEXT,
  response TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (meeting_id, owner_email),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_meeting ON meeting_rsvps(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_rsvps_owner ON meeting_rsvps(owner_email);

-- ----------------------------------------------------------------------------
-- Maintenance Requests
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id TEXT PRIMARY KEY,
  owner_email TEXT,
  category TEXT,
  description TEXT,
  status TEXT DEFAULT 'reported',
  vendor_assigned TEXT,
  photos TEXT,
  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_owner ON maintenance_requests(owner_email);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_created ON maintenance_requests(created);

-- ----------------------------------------------------------------------------
-- Assessments (HOA Dues - View Only)
-- ----------------------------------------------------------------------------

-- Assessment balances (managed externally, synced to portal)
CREATE TABLE IF NOT EXISTS assessments (
  owner_email TEXT PRIMARY KEY,
  balance REAL DEFAULT 0,
  next_due TEXT,
  paid_through TEXT,
  last_payment TEXT,
  invoice_r2_key TEXT,
  updated TEXT DEFAULT (datetime('now'))
);

-- Payment history for display (last 12 months)
CREATE TABLE IF NOT EXISTS assessment_payments (
  id TEXT PRIMARY KEY,
  owner_email TEXT,
  paid_at TEXT,
  amount REAL,
  balance_after REAL,
  created TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (owner_email) REFERENCES assessments(owner_email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_payments_owner ON assessment_payments(owner_email);
CREATE INDEX IF NOT EXISTS idx_assessment_payments_paid_at ON assessment_payments(paid_at);

-- ----------------------------------------------------------------------------
-- Feedback Collection
-- ----------------------------------------------------------------------------

-- Feedback documents uploaded by board
CREATE TABLE IF NOT EXISTS feedback_docs (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  r2_key TEXT,
  deadline TEXT,
  created_by TEXT,
  created TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_docs_created_by ON feedback_docs(created_by);
CREATE INDEX IF NOT EXISTS idx_feedback_docs_deadline ON feedback_docs(deadline);

-- Owner responses to feedback documents
CREATE TABLE IF NOT EXISTS feedback_responses (
  doc_id TEXT,
  owner_email TEXT,
  acknowledged INTEGER DEFAULT 0,
  approved INTEGER,
  comments TEXT,
  responded TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(doc_id, owner_email),
  FOREIGN KEY(doc_id) REFERENCES feedback_docs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_doc ON feedback_responses(doc_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_owner ON feedback_responses(owner_email);

-- ----------------------------------------------------------------------------
-- Vendors (Approved Contractor Directory)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  files JSON,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  updated_by TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);

-- ============================================================================
-- Notes on Feature Tables
-- ============================================================================
-- ARB Workflow:
--   1. Owner submits request via /portal/arb-request
--   2. Files uploaded to R2 (original/review/archive tiers)
--   3. ARB reviews at /portal/arb/requests
--   4. Status: pending → approved/rejected/revision_requested
--   5. Email notifications via MailChannels
--
-- Meetings:
--   - Board creates meetings at /portal/board/meetings
--   - Agenda PDF uploaded to R2
--   - Members RSVP (attending/not_attending/maybe)
--   - Automated reminders via MailChannels
--
-- Assessments:
--   - READ-ONLY display (no payment processing)
--   - Data synced from external accounting system
--   - Invoice PDFs stored in R2
--   - Florida Statute 720.303(4) compliance
--
-- Feedback:
--   - Board solicits feedback on budgets, rule changes, etc.
--   - Owners acknowledge/approve/comment
--   - Used for quorum requirements and member input
-- ============================================================================
