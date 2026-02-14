-- ============================================================================
-- CONSOLIDATED CORE SCHEMA: Foundation Tables
-- ============================================================================
-- This is the FINAL consolidated schema including ALL incremental migrations.
-- Creates core database tables including:
-- - users: User accounts with roles, contact info, and auth fields
-- - owners: Property owners with directory information
-- - directory_logs: Audit trail for directory access (with all audit fields)
-- - login_history: Session tracking
--
-- Usage:
--   npm run wrangler d1 execute clrhoa_db --local --file=./scripts/consolidated/schema-01-core.sql
--   npm run wrangler d1 execute clrhoa_db --remote --file=./scripts/consolidated/schema-01-core.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users Table (Final state with all auth and audit fields)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  id TEXT UNIQUE,  -- Required by Lucia D1 adapter (same as email for compatibility)
  role TEXT DEFAULT 'member',
  name TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Contact information (phase 3.5)
  phone TEXT,
  sms_optin INTEGER DEFAULT 0,

  -- Password authentication fields
  password_hash TEXT DEFAULT NULL,
  password_changed_at DATETIME DEFAULT NULL,
  previous_password_hashes TEXT DEFAULT NULL,  -- JSON array of last 5 hashes
  status TEXT DEFAULT 'active',  -- active, locked, disabled
  failed_login_attempts INTEGER DEFAULT 0,
  last_failed_login DATETIME DEFAULT NULL,
  locked_until DATETIME DEFAULT NULL,

  -- MFA/TOTP fields
  mfa_enabled INTEGER DEFAULT 0,
  mfa_enabled_at DATETIME DEFAULT NULL,

  -- Login tracking
  last_login DATETIME DEFAULT NULL,
  last_login_ip TEXT DEFAULT NULL,
  last_login_user_agent TEXT DEFAULT NULL,

  -- Audit fields
  created_by TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- ----------------------------------------------------------------------------
-- Owners Table (Final state with all audit and property fields)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  phone TEXT,
  phone2 TEXT,  -- Additional phone number
  phone3 TEXT,  -- Third phone number
  phones TEXT DEFAULT NULL,  -- JSON array of all phone numbers (for directory queries)
  email TEXT UNIQUE,

  -- Privacy & contact sharing
  share_contact_with_members INTEGER DEFAULT 1,

  -- Primary owner flag (one per address)
  is_primary INTEGER DEFAULT 1,

  -- Property identification
  lot_number TEXT,

  -- Audit fields (consolidated from all migrations)
  created_by_email TEXT,
  created_at DATETIME DEFAULT NULL,
  updated_by TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_address ON owners(address);
CREATE INDEX IF NOT EXISTS idx_owners_lot_number ON owners(lot_number);
CREATE INDEX IF NOT EXISTS idx_owners_is_primary ON owners(is_primary);
CREATE INDEX IF NOT EXISTS idx_owners_name ON owners(name);

-- ----------------------------------------------------------------------------
-- Directory Logs (Final state with email, IP, and role tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS directory_logs (
  id TEXT PRIMARY KEY,
  viewer_email TEXT,
  viewer_role TEXT,  -- Added for role-based audit tracking
  target_name TEXT,
  target_phone TEXT,
  target_email TEXT,  -- Added for email tracking
  ip_address TEXT,    -- Added for IP tracking
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_directory_logs_viewer ON directory_logs(viewer_email);
CREATE INDEX IF NOT EXISTS idx_directory_logs_timestamp ON directory_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_directory_logs_target_phone ON directory_logs(target_phone);
CREATE INDEX IF NOT EXISTS idx_directory_logs_target_email ON directory_logs(target_email);
CREATE INDEX IF NOT EXISTS idx_directory_logs_viewer_role ON directory_logs(viewer_role);

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

CREATE INDEX IF NOT EXISTS idx_login_history_user_email ON login_history(user_email);
CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time);
CREATE INDEX IF NOT EXISTS idx_login_history_session_id ON login_history(session_id);

-- ============================================================================
-- End of Core Schema
-- ============================================================================
