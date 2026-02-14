-- Add website to vendor_submissions (for DBs that already have the table without this column).
-- Run after db:vendor-submissions. npm run db:vendor-submissions-website:local or db:vendor-submissions-website (remote)

ALTER TABLE vendor_submissions ADD COLUMN website TEXT;
