-- Phase 3.5 add-on: Per-type email notification preferences (opt-in/opt-out).
-- JSON object keyed by type (e.g. feedback_new_doc, feedback_response_confirm). Missing key = send (default).
-- Run after schema-phase35. For existing DBs: npm run db:phase35-notification-types:local | db:phase35-notification-types

ALTER TABLE users ADD COLUMN notification_preferences TEXT;
