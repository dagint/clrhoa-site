-- SMS feature requests: track which lots want SMS (costs HOA money). No sending yet.
-- Run: npm run db:sms-feature-requests:local or db:sms-feature-requests (remote)

CREATE TABLE IF NOT EXISTS sms_feature_requests (
  id TEXT PRIMARY KEY,
  lot_number TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_feature_requests_created ON sms_feature_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_feature_requests_lot ON sms_feature_requests(lot_number);
