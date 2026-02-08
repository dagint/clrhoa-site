-- PIM/JIT elevation audit: who elevated when and when it expires.
-- Run: npm run db:pim-elevation:local or db:pim-elevation (remote)

CREATE TABLE IF NOT EXISTS pim_elevation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  elevated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pim_elevation_email ON pim_elevation_log(email);
CREATE INDEX IF NOT EXISTS idx_pim_elevation_at ON pim_elevation_log(elevated_at);
