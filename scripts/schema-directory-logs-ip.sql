-- Add IP address to directory logs (contact reveal audit) for security and forensics.
-- Run: npm run db:directory-logs-ip (remote) or db:directory-logs-ip:local
ALTER TABLE directory_logs ADD COLUMN ip_address TEXT;
