-- ARB Multi-Stage Voting: Notification Debounce Table
-- Prevents email spam by tracking when notifications were last sent
--
-- Local: npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-arb-notification-debounce.sql
-- Remote: npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-arb-notification-debounce.sql

CREATE TABLE IF NOT EXISTS arb_notification_debounce (
  request_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  last_sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_arb_notification_debounce_request
  ON arb_notification_debounce(request_id);

CREATE INDEX IF NOT EXISTS idx_arb_notification_debounce_type
  ON arb_notification_debounce(notification_type);

CREATE INDEX IF NOT EXISTS idx_arb_notification_debounce_last_sent
  ON arb_notification_debounce(last_sent_at);
