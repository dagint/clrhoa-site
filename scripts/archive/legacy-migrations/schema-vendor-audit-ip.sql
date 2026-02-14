-- Add IP address to vendor audit log for security and forensics.
-- Run: npm run db:vendor-audit-ip (remote) or db:vendor-audit-ip:local
ALTER TABLE vendor_audit_log ADD COLUMN ip_address TEXT;
