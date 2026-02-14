-- Add optional "post to public news" flag for meetings.
-- Run: npm run db:meetings-post-to-public:local or db:meetings-post-to-public (remote)

ALTER TABLE meetings ADD COLUMN post_to_public_news INTEGER DEFAULT 0;
