-- Add website to vendors. (vendor_submissions: use schema or db:vendor-submissions-website.)
-- Safe to re-run: npm scripts treat "duplicate column" as already applied.

ALTER TABLE vendors ADD COLUMN website TEXT;
