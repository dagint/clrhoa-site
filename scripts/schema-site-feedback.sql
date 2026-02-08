-- Site feedback widget: thumbs up/down + 140-char comment. No PII; URL, time, viewport, session_id only.
-- Run: npm run db:site-feedback:local or db:site-feedback (remote)

CREATE TABLE IF NOT EXISTS site_feedback (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  viewport TEXT,
  session_id TEXT,
  thumbs INTEGER NOT NULL,
  comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_feedback_created ON site_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_site_feedback_thumbs ON site_feedback(thumbs);
