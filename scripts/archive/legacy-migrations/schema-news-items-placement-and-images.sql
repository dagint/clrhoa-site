-- Add placement (show on portal) and images for board news.
-- Run: npm run db:news-items-placement:local or db:news-items-placement (remote)
-- show_on_portal: 1 = show in member portal News; 0 = do not show (e.g. public-only if you later add that).
-- images: JSON array of R2 keys (e.g. ["news/ID/f1.jpg","news/ID/f2.jpg"]).

ALTER TABLE news_items ADD COLUMN show_on_portal INTEGER DEFAULT 1;
ALTER TABLE news_items ADD COLUMN images TEXT;
