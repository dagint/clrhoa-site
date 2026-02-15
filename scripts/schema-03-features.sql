-- ============================================================================
-- CONSOLIDATED FEATURES SCHEMA: Application Features & Business Logic
-- ============================================================================
-- This is the FINAL consolidated schema including ALL incremental migrations.
-- Creates all feature-specific tables including:
-- - ARB: Architectural Review Board workflow (with v2-v8 enhancements, voting, audit)
-- - Electronic Signatures: ESIGN Act compliant signature capture
-- - Meetings: Board/ARB meeting scheduling and RSVPs
-- - Maintenance: Common area maintenance requests
-- - Assessments: HOA dues and payment history (view-only)
-- - Feedback: Board-initiated feedback collection
-- - Vendors: Approved vendor directory and submissions
-- - News: Public and member-only news items
-- - Documents: Public and member-only document management
-- - Preapproval: Architectural pre-approval library
-- - Contact: Contact form submissions
--
-- Usage:
--   npm run wrangler d1 execute clrhoa_db --local --file=./scripts/consolidated/schema-03-features.sql
--   npm run wrangler d1 execute clrhoa_db --remote --file=./scripts/consolidated/schema-03-features.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ARB (Architectural Review Board) - FINAL STATE with all v2-v8 columns
-- ----------------------------------------------------------------------------

-- ARB request submissions (consolidated from all migrations)
CREATE TABLE IF NOT EXISTS arb_requests (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,

  -- v2 fields (applicant details matching CLR-ARB-Request-Form-2026)
  applicant_name TEXT,
  phone TEXT,
  property_address TEXT,
  application_type TEXT,

  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',

  -- E-signature fields (legacy and new)
  esign_timestamp DATETIME,
  arb_esign TEXT,
  signature_id TEXT,  -- Links to electronic_signatures.id

  -- v4 copy tracking
  copied_from_id TEXT,  -- Source request ID when this request was created by copy

  -- v5 revision notes
  revision_notes TEXT,  -- ARB provides context when returning request for revision

  -- v6 notes fields
  arb_internal_notes TEXT,
  owner_notes TEXT,

  -- v7 deadline field
  review_deadline DATETIME,

  -- v8 soft delete tracking
  deleted_at DATETIME,

  -- Multi-stage voting workflow fields (from schema-arb-voting.sql)
  workflow_version INTEGER DEFAULT 1,  -- 1 = legacy single-reviewer, 2 = multi-stage voting
  current_stage TEXT DEFAULT NULL,     -- DRAFT, SUBMITTED, ARC_REVIEW, ARC_APPROVED, etc.
  current_cycle INTEGER DEFAULT 1,     -- Revision cycle counter
  submitted_at DATETIME DEFAULT NULL,  -- Starts 30-day deadline clock
  resolved_at DATETIME DEFAULT NULL,   -- Final decision timestamp
  auto_approved_reason TEXT DEFAULT NULL,  -- e.g., 'deadline_expired'
  deadline_date DATETIME DEFAULT NULL, -- submitted_at + 30 days

  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_arb_requests_owner ON arb_requests(owner_email);
CREATE INDEX IF NOT EXISTS idx_arb_requests_status ON arb_requests(status);
CREATE INDEX IF NOT EXISTS idx_arb_requests_created ON arb_requests(created);
CREATE INDEX IF NOT EXISTS idx_arb_requests_signature ON arb_requests(signature_id);
CREATE INDEX IF NOT EXISTS idx_arb_requests_deadline ON arb_requests(review_deadline);
CREATE INDEX IF NOT EXISTS idx_arb_requests_deleted ON arb_requests(deleted_at);
CREATE INDEX IF NOT EXISTS idx_arb_requests_workflow_version ON arb_requests(workflow_version);
CREATE INDEX IF NOT EXISTS idx_arb_requests_current_stage ON arb_requests(current_stage);
CREATE INDEX IF NOT EXISTS idx_arb_requests_deadline_date ON arb_requests(deadline_date);

-- ARB file attachments (references R2 storage)
CREATE TABLE IF NOT EXISTS arb_files (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  r2_keys TEXT NOT NULL,
  original_size INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reference_only INTEGER DEFAULT 0  -- 1 = pointer to R2 objects owned by another request
);

CREATE INDEX IF NOT EXISTS idx_arb_files_request ON arb_files(request_id);

-- ARB Audit Log (FINAL STATE with IP, cycle, metadata, deleted_at)
CREATE TABLE IF NOT EXISTS arb_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  changed_by_email TEXT,
  changed_by_role TEXT,
  notes TEXT,
  ip_address TEXT,  -- Added from schema-arb-audit-ip.sql
  cycle INTEGER DEFAULT 1,  -- From voting workflow
  metadata TEXT DEFAULT NULL,  -- JSON for vote details
  deleted_at DATETIME,  -- Soft delete tracking
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES arb_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_arb_audit_request ON arb_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_arb_audit_created ON arb_audit_log(created);
CREATE INDEX IF NOT EXISTS idx_arb_audit_deleted ON arb_audit_log(deleted_at);

-- ARB Multi-Stage Voting (from schema-arb-voting.sql)
CREATE TABLE IF NOT EXISTS arc_request_votes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  voter_email TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('ARC_REVIEW', 'BOARD_REVIEW')),
  vote TEXT NOT NULL CHECK (vote IN ('APPROVE', 'DENY', 'RETURN', 'ABSTAIN')),
  comment TEXT,
  voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  cycle INTEGER DEFAULT 1 NOT NULL,
  FOREIGN KEY (request_id) REFERENCES arb_requests(id),
  UNIQUE(request_id, voter_email, stage, cycle)
);

CREATE INDEX IF NOT EXISTS idx_arc_votes_request_stage ON arc_request_votes(request_id, stage, cycle);
CREATE INDEX IF NOT EXISTS idx_arc_votes_voter ON arc_request_votes(voter_email);
CREATE INDEX IF NOT EXISTS idx_arc_votes_stage ON arc_request_votes(stage);

-- ARB Notification Debounce (prevents email spam)
CREATE TABLE IF NOT EXISTS arb_notification_debounce (
  request_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  last_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_arb_notification_debounce_request ON arb_notification_debounce(request_id);
CREATE INDEX IF NOT EXISTS idx_arb_notification_debounce_type ON arb_notification_debounce(notification_type);
CREATE INDEX IF NOT EXISTS idx_arb_notification_debounce_last_sent ON arb_notification_debounce(last_sent_at);

-- ----------------------------------------------------------------------------
-- Electronic Signatures (ESIGN Act Compliant)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS electronic_signatures (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL,        -- 'arb_request', 'proxy_form', 'contract', etc.
  document_id TEXT NOT NULL,          -- Foreign key to related document
  signer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL,       -- JSON: { typedName, consentGiven, intentStatement }
  ip_address TEXT,
  user_agent TEXT,
  signed_at TEXT NOT NULL,            -- ISO 8601 timestamp
  consent_acknowledged INTEGER NOT NULL DEFAULT 1,
  signature_valid INTEGER NOT NULL DEFAULT 1,
  verification_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_esig_document ON electronic_signatures(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_esig_signer ON electronic_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_esig_signed_at ON electronic_signatures(signed_at DESC);

-- E-Signature Audit Log
CREATE TABLE IF NOT EXISTS esignature_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature_id TEXT NOT NULL,
  event_type TEXT NOT NULL,           -- 'CREATED', 'VERIFIED', 'REVOKED', 'VIEWED'
  actor_email TEXT,
  ip_address TEXT,
  details TEXT,                       -- JSON metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_esig_audit_signature ON esignature_audit_log(signature_id);
CREATE INDEX IF NOT EXISTS idx_esig_audit_created ON esignature_audit_log(created_at DESC);

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
  post_to_public_news INTEGER DEFAULT 0,  -- From schema-meetings-post-to-public-news.sql
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
  paid_through_after TEXT,  -- From schema-assessment-payments-paid-through-after.sql
  amount REAL,
  payment_method TEXT DEFAULT 'check',  -- From schema-assessment-payments-method-check.sql
  balance_after REAL,
  recorded_by TEXT,  -- From schema-assessment-payments-recorded-by.sql (email of user who recorded)
  check_number TEXT,  -- Check number if payment_method is 'check'
  created TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (owner_email) REFERENCES assessments(owner_email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_payments_owner ON assessment_payments(owner_email);
CREATE INDEX IF NOT EXISTS idx_assessment_payments_paid_at ON assessment_payments(paid_at);

-- Special Assessments (one-time charges)
CREATE TABLE IF NOT EXISTS special_assessments (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,  -- From schema-phase5-special-assessments.sql
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT,
  paid_at TEXT,  -- From schema-phase5-special-assessments.sql
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),  -- Legacy column (keep for backward compatibility)
  created TEXT DEFAULT (datetime('now'))  -- Used by assessments-db.ts
);

CREATE INDEX IF NOT EXISTS idx_special_assessments_owner ON special_assessments(owner_email);
CREATE INDEX IF NOT EXISTS idx_special_assessments_status ON special_assessments(status);
CREATE INDEX IF NOT EXISTS idx_special_assessments_due_date ON special_assessments(due_date);

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

-- Site Feedback (member suggestions)
CREATE TABLE IF NOT EXISTS site_feedback (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  submitted_by TEXT,
  status TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  board_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_feedback_status ON site_feedback(status);
CREATE INDEX IF NOT EXISTS idx_site_feedback_created_at ON site_feedback(created_at DESC);

-- ----------------------------------------------------------------------------
-- Vendors (Approved Contractor Directory)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,  -- From schema-vendors-website.sql
  notes TEXT,
  files JSON,
  show_on_public INTEGER DEFAULT 0,  -- From schema-vendors-show-on-public.sql
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  updated_by TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_show_on_public ON vendors(show_on_public);

-- Vendor Submissions (member-suggested vendors pending approval)
CREATE TABLE IF NOT EXISTS vendor_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  files JSON,
  status TEXT DEFAULT 'pending',
  submitted_by TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  review_notes TEXT,
  created_vendor_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendor_submissions_status ON vendor_submissions(status);
CREATE INDEX IF NOT EXISTS idx_vendor_submissions_submitted_by ON vendor_submissions(submitted_by);

-- Vendor Audit Log
CREATE TABLE IF NOT EXISTS vendor_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_by_email TEXT,
  changed_by_role TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,  -- From schema-vendor-audit-ip.sql
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_vendor ON vendor_audit_log(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_audit_created ON vendor_audit_log(created);

-- ----------------------------------------------------------------------------
-- News Items (Public and Member-Only)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_placement TEXT DEFAULT 'above',  -- From schema-news-items-placement-and-images.sql
  image_r2_key TEXT,  -- R2 key for optional header image
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_public INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_news_items_created ON news_items(created_at);
CREATE INDEX IF NOT EXISTS idx_news_items_public ON news_items(is_public);

-- ----------------------------------------------------------------------------
-- Documents (Public and Member-Only)
-- ----------------------------------------------------------------------------

-- Public documents (bylaws, covenants, proxy form, ARB request form)
CREATE TABLE IF NOT EXISTS public_documents (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  file_key TEXT,
  content_type TEXT,
  effective_date TEXT,
  updated_at DATETIME,
  updated_by_email TEXT,
  updated_by_role TEXT
);

-- Member-only documents (redacted minutes, budgets, contracts)
CREATE TABLE IF NOT EXISTS member_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  file_key TEXT NOT NULL,
  content_type TEXT,
  uploaded_at DATETIME DEFAULT (datetime('now')),
  uploaded_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_documents_category ON member_documents(category);
CREATE INDEX IF NOT EXISTS idx_member_documents_uploaded_at ON member_documents(uploaded_at DESC);

-- ----------------------------------------------------------------------------
-- Preapproval Library (Phase 6)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS preapproval_items (
  id TEXT PRIMARY KEY,
  category TEXT,
  title TEXT,
  description TEXT,
  rules TEXT,
  photos JSON,
  approved INTEGER DEFAULT 0,  -- From schema-phase6-preapproval-approved.sql
  created_by TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_preapproval_category ON preapproval_items(category);
CREATE INDEX IF NOT EXISTS idx_preapproval_created ON preapproval_items(created DESC);
CREATE INDEX IF NOT EXISTS idx_preapproval_approved ON preapproval_items(approved);

-- ----------------------------------------------------------------------------
-- Contact Form Submissions
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient TEXT NOT NULL,
  email_sent INTEGER NOT NULL DEFAULT 0,
  email_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email_sent ON contact_submissions(email_sent);

-- ----------------------------------------------------------------------------
-- Notifications (Phase 3.5)
-- ----------------------------------------------------------------------------

-- Notification Types (board-configurable)
CREATE TABLE IF NOT EXISTS notification_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  channels TEXT DEFAULT 'email',  -- JSON array: ["email", "sms"]
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notifications (
  user_email TEXT,
  notification_type_id TEXT,
  enabled INTEGER DEFAULT 1,
  channels TEXT DEFAULT 'email',
  PRIMARY KEY (user_email, notification_type_id),
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE,
  FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_email);

-- Notification dismissals (for banner notifications)
CREATE TABLE IF NOT EXISTS notification_dismissals (
  email TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  dismissed_at TEXT NOT NULL,
  PRIMARY KEY (email, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user ON notification_dismissals(email);

-- SMS Feature Requests (track member interest in SMS notifications)
CREATE TABLE IF NOT EXISTS sms_feature_requests (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  phone TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_feature_requests_user ON sms_feature_requests(user_email);

-- ============================================================================
-- Notes on Feature Tables
-- ============================================================================
-- ARB Workflow:
--   - V1 (Legacy): Single reviewer approves/denies
--   - V2 (Multi-stage): ARC reviews first, then Board reviews
--   - 30-day auto-approval if no decision made
--   - Full audit trail with cycle tracking for revisions
--
-- E-Signatures:
--   - ESIGN Act compliant (intent, consent, attribution, association, retention)
--   - Used for ARB requests, proxy forms, contracts
--   - Verification codes for audit
--
-- Meetings:
--   - Board creates meetings with agenda PDFs
--   - Members RSVP (attending/not_attending/maybe)
--   - Can optionally post to public news page
--
-- Assessments:
--   - READ-ONLY display (no payment processing)
--   - Data synced from external accounting system
--   - Special assessments for one-time charges
--
-- Vendors:
--   - Approved contractor directory
--   - Members can submit suggestions for approval
--   - Can show on public website or portal-only
--
-- Documents:
--   - Public: Bylaws, covenants, forms (on /documents)
--   - Member-only: Minutes, budgets, contracts (on /portal/documents)
--   - Florida Statute 720.303(4) compliance
--
-- Preapproval Library:
--   - Pre-approved architectural modifications
--   - Photos and rules for common modifications
--   - Speeds up ARB approval process
-- ============================================================================
