-- Dashboard / portal: user dismissals of "Action needed" and "Outstanding items" notices.
-- Keys: action_feedback, action_maintenance, action_meetings, staff_outstanding.
-- Dismissed notices are hidden for DISMISSAL_DAYS (see lib); after that they can reappear.
CREATE TABLE IF NOT EXISTS notification_dismissals (
  email TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  dismissed_at TEXT NOT NULL,
  PRIMARY KEY (email, notification_key)
);
