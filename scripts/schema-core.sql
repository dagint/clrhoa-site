-- ============================================================================
-- CORE SCHEMA: Foundation tables for CLRHOA Portal
-- ============================================================================
-- This script creates the core database schema including:
-- - users: User accounts with roles and contact info
-- - owners: Property owners with directory information
-- - directory_logs: Audit trail for directory access
--
-- Usage:
--   npm run db:schema:core:local   (local development)
--   npm run db:schema:core         (production)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  role TEXT DEFAULT 'member',
  name TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Contact information (added in phase 3.5)
  phone TEXT,
  sms_optin INTEGER DEFAULT 0,

  -- Future auth columns (nullable until password auth is implemented)
  password_hash TEXT DEFAULT NULL,
  password_changed_at DATETIME DEFAULT NULL,
  previous_password_hashes TEXT DEFAULT NULL,
  status TEXT DEFAULT 'active',
  failed_login_attempts INTEGER DEFAULT 0,
  last_failed_login DATETIME DEFAULT NULL,
  locked_until DATETIME DEFAULT NULL,
  mfa_enabled INTEGER DEFAULT 0,
  mfa_enabled_at DATETIME DEFAULT NULL,
  last_login DATETIME DEFAULT NULL,
  last_login_ip TEXT DEFAULT NULL,
  last_login_user_agent TEXT DEFAULT NULL,
  created_by TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by TEXT DEFAULT NULL
);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ----------------------------------------------------------------------------
-- Owners Table (Property Directory)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT UNIQUE,

  -- Privacy & contact sharing
  share_contact_with_members INTEGER DEFAULT 1,

  -- Primary owner flag (one per address)
  is_primary INTEGER DEFAULT 1,

  -- Property identification
  lot_number TEXT,

  -- Audit fields
  created_by_email TEXT,
  created_at DATETIME DEFAULT NULL,
  updated_by TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
);

-- Owners indexes
CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_address ON owners(address);
CREATE INDEX IF NOT EXISTS idx_owners_lot_number ON owners(lot_number);
CREATE INDEX IF NOT EXISTS idx_owners_is_primary ON owners(is_primary);

-- ----------------------------------------------------------------------------
-- Directory Logs (Audit trail for contact info access)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS directory_logs (
  id TEXT PRIMARY KEY,
  viewer_email TEXT,
  target_name TEXT,
  target_phone TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Directory logs indexes
CREATE INDEX IF NOT EXISTS idx_directory_logs_viewer ON directory_logs(viewer_email);
CREATE INDEX IF NOT EXISTS idx_directory_logs_timestamp ON directory_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_directory_logs_target_phone ON directory_logs(target_phone);

-- ----------------------------------------------------------------------------
-- Login History (Session tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_history (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT
);

-- Login history indexes
CREATE INDEX IF NOT EXISTS idx_login_history_user_email ON login_history(user_email);
CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time);
CREATE INDEX IF NOT EXISTS idx_login_history_session_id ON login_history(session_id);
