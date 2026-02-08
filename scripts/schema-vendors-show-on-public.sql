-- Add flag for vendors visible on public & portal (one list for both).
-- Run: npm run db:vendors-show-on-public:local or db:vendors-show-on-public (remote)
-- Default 1 so existing vendors stay visible.

ALTER TABLE vendors ADD COLUMN show_on_public INTEGER DEFAULT 1;
