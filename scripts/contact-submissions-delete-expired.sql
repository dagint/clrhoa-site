-- Optional: delete contact form submissions older than 1 year (same cutoff as the board report).
-- The board report already hides these; this frees storage.
-- Run: npm run db:contact-submissions-delete-expired (remote) or db:contact-submissions-delete-expired:local
-- 
-- For automated cleanup, deploy the contact-cleanup worker (runs monthly):
--   npm run contact-cleanup:deploy
-- See workers/contact-cleanup/ for details.

DELETE FROM contact_submissions WHERE created_at < datetime('now', '-1 year');
