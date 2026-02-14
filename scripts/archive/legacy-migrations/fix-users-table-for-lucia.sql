-- Fix users table to be compatible with Lucia
-- Lucia expects an 'id' column as primary key

-- Step 1: Create new users table with id column
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'member',
  name TEXT,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  phone TEXT,
  sms_optin INTEGER DEFAULT 0,
  notification_preferences TEXT,
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

-- Step 2: Copy data from old table (use email as id for existing users)
INSERT INTO users_new (
  id, email, role, name, created, phone, sms_optin, notification_preferences,
  password_hash, password_changed_at, previous_password_hashes, status,
  failed_login_attempts, last_failed_login, locked_until, mfa_enabled,
  mfa_enabled_at, last_login, last_login_ip, last_login_user_agent,
  created_by, updated_at, updated_by
)
SELECT
  email as id, email, role, name, created, phone, sms_optin, notification_preferences,
  password_hash, password_changed_at, previous_password_hashes, status,
  failed_login_attempts, last_failed_login, locked_until, mfa_enabled,
  mfa_enabled_at, last_login, last_login_ip, last_login_user_agent,
  created_by, updated_at, updated_by
FROM users;

-- Step 3: Drop old table
DROP TABLE users;

-- Step 4: Rename new table
ALTER TABLE users_new RENAME TO users;

-- Step 5: Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
