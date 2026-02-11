# Authentication Schema Migration - Phase 1

This directory contains database schema migrations for implementing comprehensive password-based authentication, replacing the KV whitelist system.

## Overview

**Current State:** KV whitelist-based authentication (email only, no passwords)
**Target State:** Full password-based authentication with MFA, sessions, and audit logging

**Migration Strategy:** Backward compatible during transition period
- Users with `password_hash = NULL` fall back to KV whitelist (legacy)
- Users with `password_hash != NULL` use password authentication (new)
- After all users migrate, KV whitelist can be deprecated

---

## Schema Files

Run these migrations **in order**:

### 1. `schema-auth-users-migration.sql`
**Purpose:** Add password auth, MFA, and security columns to existing `users` table

**New Columns:**
- **Password Auth:** `password_hash`, `password_changed_at`, `previous_password_hashes`
- **Account Security:** `status`, `failed_login_attempts`, `last_failed_login`, `locked_until`
- **MFA:** `mfa_enabled`, `mfa_enabled_at` (secrets stored encrypted in KV)
- **Login Tracking:** `last_login`, `last_login_ip`, `last_login_user_agent`
- **Audit:** `created_by`, `updated_at`, `updated_by`
- **Contact:** `phone`, `sms_optin`

**Backward Compatibility:** All columns are nullable/default, won't break existing users

---

### 2. `schema-auth-password-tokens.sql`
**Purpose:** Password reset and setup token storage

**Tables:**
- `password_reset_tokens` - Forgot password flow (1-2 hour expiry)
- `password_setup_tokens` - New user onboarding (24-48 hour expiry)

**Security Features:**
- Tokens hashed (SHA-256) before storage
- Single-use enforcement (`used` flag)
- Expiration timestamps
- IP and User-Agent tracking

---

### 3. `schema-auth-sessions.sql`
**Purpose:** Database-backed session storage (replaces cookie-only sessions)

**Table:** `sessions`

**Features:**
- Session revocation support
- Concurrent session limit (3 per user)
- Anomaly detection (fingerprint, IP, User-Agent tracking)
- Sliding window expiration (15 min) + absolute timeout (24 hours)
- Session metadata (device, location)

**Benefits over cookie-only:**
- Admin can view/revoke user sessions
- User can view/revoke their own sessions
- Better security monitoring

---

### 4. `schema-auth-audit-logs.sql`
**Purpose:** Comprehensive audit logging for compliance and security

**Table:** `audit_logs`

**Logs:**
- Authentication events (login, logout, password changes)
- Authorization events (permission denials, role changes)
- Administrative events (user creation, role assignments)
- Security events (rate limits, suspicious activity)

**Fields:**
- Event classification (type, category, severity)
- Actor and target users
- Request context (IP, User-Agent, session, correlation ID)
- Action outcome and details (JSON)

**Retention:** 90 days minimum, 1 year recommended

---

### 5. `schema-auth-security-events.sql`
**Purpose:** Security incident tracking and alerting

**Table:** `security_events`

**Tracks:**
- Rate limit violations
- Account lockouts
- Suspicious login attempts
- Session hijacking detection
- Token reuse attempts

**Features:**
- Severity classification (info, warning, critical)
- Resolution tracking (who resolved, when, notes)
- Auto-remediation support (automated responses)

**Use Cases:**
- Security dashboard
- Admin alerts
- Incident response

---

### 6. `schema-auth-mfa-backup-codes.sql`
**Purpose:** MFA backup codes for account recovery

**Table:** `mfa_backup_codes`

**Features:**
- 10 single-use backup codes per user
- Codes hashed with bcrypt (NOT stored in plain text)
- Used flag prevents reuse
- Regeneration support

**Note:** TOTP secrets stored encrypted in KV, backup codes in D1

---

## Running Migrations

### Local Development

```bash
# Run all auth migrations in order
npm run db:migrate:auth:local

# Or run individually
wrangler d1 execute clrhoa_db --local --file=scripts/schema-auth-users-migration.sql
wrangler d1 execute clrhoa_db --local --file=scripts/schema-auth-password-tokens.sql
wrangler d1 execute clrhoa_db --local --file=scripts/schema-auth-sessions.sql
wrangler d1 execute clrhoa_db --local --file=scripts/schema-auth-audit-logs.sql
wrangler d1 execute clrhoa_db --local --file=scripts/schema-auth-security-events.sql
wrangler d1 execute clrhoa_db --local --file=scripts/schema-auth-mfa-backup-codes.sql
```

### Production

```bash
# Run all auth migrations in order
npm run db:migrate:auth

# Or run individually (remove --local flag)
wrangler d1 execute clrhoa_db --file=scripts/schema-auth-users-migration.sql
# ... repeat for each file
```

---

## Verification

After running migrations, verify tables exist:

```bash
# Local
wrangler d1 execute clrhoa_db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Check users table columns
wrangler d1 execute clrhoa_db --local --command="PRAGMA table_info(users);"

# Count tables (should be 6 new tables + existing tables)
wrangler d1 execute clrhoa_db --local --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table';"
```

Expected new tables:
- `password_reset_tokens`
- `password_setup_tokens`
- `sessions`
- `audit_logs`
- `security_events`
- `mfa_backup_codes`

---

## Database Size Impact

**Estimated storage (1000 users):**
- Users table: ~500 KB (existing) → ~1.5 MB (with new columns)
- Sessions: ~2 MB (avg 2 active sessions per user)
- Audit logs: ~10 MB (first year, depends on activity)
- Security events: ~1 MB (first year)
- Tokens: ~100 KB (active tokens only, cleaned up regularly)
- MFA backup codes: ~50 KB (only for users with MFA enabled)

**Total:** ~15 MB for 1000 users (well within D1 free tier: 5 GB)

---

## Cleanup Jobs

Regular maintenance tasks (run via cron/scheduled workers):

```sql
-- Delete expired password reset tokens (older than 2 hours)
DELETE FROM password_reset_tokens WHERE expires_at < datetime('now', '-2 hours');

-- Delete expired password setup tokens (older than 48 hours)
DELETE FROM password_setup_tokens WHERE expires_at < datetime('now', '-48 hours');

-- Delete expired sessions
DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;

-- Clean up old audit logs (keep 1 year)
DELETE FROM audit_logs WHERE timestamp < datetime('now', '-365 days');

-- Clean up resolved security events (keep 2 years)
DELETE FROM security_events WHERE timestamp < datetime('now', '-730 days') AND resolved = 1;
```

---

## Migration Rollback

**WARNING:** Rolling back will delete all auth data. Only do this in development.

```bash
# Drop all auth tables (LOCAL ONLY)
wrangler d1 execute clrhoa_db --local --command="DROP TABLE IF EXISTS mfa_backup_codes;"
wrangler d1 execute clrhoa_db --local --command="DROP TABLE IF EXISTS security_events;"
wrangler d1 execute clrhoa_db --local --command="DROP TABLE IF EXISTS audit_logs;"
wrangler d1 execute clrhoa_db --local --command="DROP TABLE IF EXISTS sessions;"
wrangler d1 execute clrhoa_db --local --command="DROP TABLE IF EXISTS password_setup_tokens;"
wrangler d1 execute clrhoa_db --local --command="DROP TABLE IF EXISTS password_reset_tokens;"

# Users table: Can't easily rollback ALTER TABLE in SQLite
# Safer to restore from backup or recreate database
```

**Best Practice:** Test migrations in local environment first, then production.

---

## Next Steps

After schema is deployed:

1. **PR #2:** Implement audit logging library (`src/lib/audit-log.ts`)
2. **PR #3:** Implement rate limiting and security utilities
3. **PR #4:** Implement password hashing and validation
4. **PR #5:** Integrate Lucia auth library with D1 session adapter
5. **PR #6:** Implement email/password login endpoint
6. **PR #7:** Implement logout and session management
7. **PR #8-14:** Password setup, reset, MFA, admin tools, security hardening

---

## Security Considerations

**What's in D1 (SQLite):**
- Password hashes (bcrypt/argon2, safe to store)
- Token hashes (SHA-256, safe to store)
- Backup code hashes (bcrypt, safe to store)
- Audit logs (no sensitive data)
- Session metadata (safe)

**What's in KV (encrypted):**
- MFA TOTP secrets (encrypted at rest)

**What's NOT stored anywhere:**
- Plain text passwords (never stored, only hashed)
- Plain text tokens (only hashes stored)
- Plain text backup codes (only hashes stored)
- MFA verification codes (ephemeral, validated and discarded)

---

## Questions?

See main documentation: `/docs/AUTH_IMPLEMENTATION.md`
