-- Add viewer_role to directory_logs for audit transparency (member vs board/arb/admin).
-- Run: npm run db:directory-logs-viewer-role:local or db:directory-logs-viewer-role (remote)

ALTER TABLE directory_logs ADD COLUMN viewer_role TEXT;
