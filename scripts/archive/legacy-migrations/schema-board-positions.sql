-- Add board_title column to owners table for current position display
-- Add board_positions table for historical position tracking
-- Run: npm run db:board-positions:local or db:board-positions (remote)

-- Add current board title to owners table (denormalized for fast directory display)
ALTER TABLE owners ADD COLUMN board_title TEXT;

-- Create board_positions table for historical tracking
CREATE TABLE IF NOT EXISTS board_positions (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for looking up current positions (end_date IS NULL means active)
CREATE INDEX IF NOT EXISTS idx_board_positions_active ON board_positions(user_email, end_date);
CREATE INDEX IF NOT EXISTS idx_board_positions_title ON board_positions(title, end_date);
