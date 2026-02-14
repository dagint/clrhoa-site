-- Migration: Add id column to users table for Lucia compatibility
-- Lucia's D1 adapter expects users.id to exist

-- Add id column (will be same as email for compatibility)
ALTER TABLE users ADD COLUMN id TEXT;

-- Populate id with email values for existing users
UPDATE users SET id = email WHERE id IS NULL;

-- Create unique index on id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id ON users(id);
