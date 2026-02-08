-- Board-added news: optional public (news page) or portal-only. Same DB as rest of site.
-- Run: npm run db:news-items:local or db:news-items (remote)

CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_public INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_news_items_created ON news_items(created_at);
CREATE INDEX IF NOT EXISTS idx_news_items_public ON news_items(is_public);
