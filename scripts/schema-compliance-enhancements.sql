-- Enhancements to existing tables for compliance tracking

-- Add compliance tracking columns to member_documents
ALTER TABLE member_documents ADD COLUMN requirement_id TEXT;
ALTER TABLE member_documents ADD COLUMN is_redacted INTEGER DEFAULT 0;
ALTER TABLE member_documents ADD COLUMN redacted_by TEXT;
ALTER TABLE member_documents ADD COLUMN redacted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_member_documents_requirement
  ON member_documents(requirement_id);

-- Add compliance tracking columns to public_documents
ALTER TABLE public_documents ADD COLUMN requirement_id TEXT;
ALTER TABLE public_documents ADD COLUMN is_redacted INTEGER DEFAULT 0;
ALTER TABLE public_documents ADD COLUMN redacted_by TEXT;
ALTER TABLE public_documents ADD COLUMN redacted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_public_documents_requirement
  ON public_documents(requirement_id);

-- Add meeting type tracking to meetings table
ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'member';
ALTER TABLE meetings ADD COLUMN notice_posted_at TEXT;
ALTER TABLE meetings ADD COLUMN agenda_posted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_type_datetime
  ON meetings(meeting_type, datetime);
