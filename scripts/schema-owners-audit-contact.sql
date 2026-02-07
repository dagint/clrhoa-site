-- Add audit and contact-sharing fields to owners.
-- created_by_email: who added this owner (for audit transparency).
-- share_contact_with_members: 1 = share with other members (default), 0 = opt out (Board/ARB/Admin can still see; reveals are audited).
-- Run: npm run db:owners-audit-contact:local or db:owners-audit-contact (remote)
-- Idempotent: safe to run multiple times.

-- SQLite 3.35+ supports IF NOT EXISTS for ADD COLUMN
ALTER TABLE owners ADD COLUMN created_by_email TEXT;
ALTER TABLE owners ADD COLUMN share_contact_with_members INTEGER DEFAULT 1;
