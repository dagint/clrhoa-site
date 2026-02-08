-- D1 schema for CLR HOA portal. Run: npm run db:init (remote) or npm run db:init:local
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  role TEXT DEFAULT 'member',
  name TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP
);
