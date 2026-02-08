-- Phase 4: Meetings Calendar + Maintenance Requests.
-- Run after schema.sql, schema-arb.sql, schema-phase3.sql.
-- npm run db:phase4:local or db:phase4 (remote)

-- Meetings (board creates; owners view and RSVP)
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  datetime TEXT,
  location TEXT,
  agenda_r2_key TEXT,
  created_by TEXT,
  created TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meeting_rsvps (
  meeting_id TEXT,
  owner_email TEXT,
  response TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (meeting_id, owner_email),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);

-- Maintenance requests (owners submit; board manages)
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id TEXT PRIMARY KEY,
  owner_email TEXT,
  category TEXT,
  description TEXT,
  status TEXT DEFAULT 'reported',
  vendor_assigned TEXT,
  photos TEXT,
  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now'))
);
