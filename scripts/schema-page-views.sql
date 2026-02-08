-- Usage metrics: page views for public stats (daily/weekly anon) and admin (user_id -> pages -> timestamps).
-- Run: npm run db:page-views:local or db:page-views (remote)

CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id);
