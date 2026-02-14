-- Phase 3: Directory + Vendors. Run after schema.sql and schema-arb.sql.
-- npm run db:phase3:local or db:phase3 (remote)

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS directory_logs (
  id TEXT PRIMARY KEY,
  viewer_email TEXT,
  target_name TEXT,
  target_phone TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  files JSON,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);
