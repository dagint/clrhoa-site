-- Contact form submissions: backup log in case email fails. Board can view at /board/contacts.
-- Run: npm run db:contact-submissions:local or db:contact-submissions (remote)

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
