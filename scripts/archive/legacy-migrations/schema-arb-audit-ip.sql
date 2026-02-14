-- Add IP address to ARB audit log for security and forensics.
-- Run: npm run db:arb-audit-ip (remote) or db:arb-audit-ip:local
ALTER TABLE arb_audit_log ADD COLUMN ip_address TEXT;
