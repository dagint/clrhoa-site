# Authentication Schema - Consolidated

> **⚠️ NOTE:** This documentation has been updated for the consolidated schema approach.
> Individual migration files have been archived to `archive/legacy-migrations/`.
> All auth tables are now created via `schema-02-auth-sessions.sql`.

## Overview

**Current State:** Full password-based authentication with Lucia v3, MFA, sessions, and audit logging
**Schema File:** `scripts/schema-02-auth-sessions.sql`

**Migration Strategy:** Idempotent - safe to run multiple times
- Uses `CREATE TABLE IF NOT EXISTS`
- All columns have defaults where appropriate
- Backward compatible with existing data

---

## Consolidated Schema

The consolidated `schema-02-auth-sessions.sql` creates all auth-related tables:

### Tables Included

1. **sessions** - Lucia v3 database-backed sessions with PIM support
2. **password_reset_tokens** - Forgot password flow
3. **password_setup_tokens** - New user onboarding
4. **mfa_backup_codes** - MFA backup codes
5. **audit_logs** - Comprehensive security audit trail
6. **security_events** - Critical security monitoring
7. **pim_elevation_logs** - Privilege elevation tracking

### Key Features

**Password Security:**
- Passwords hashed with bcrypt (cost factor 10)
- Password history tracking (prevent reuse of last 5 passwords)
- Automatic lockout after 5 failed attempts (15 min cooldown)
- Password strength requirements enforced

**Session Management (Lucia v3):**
- HttpOnly session cookies (XSS protection)
- Session fingerprinting (IP + User-Agent hash)
- Automatic expiration (30 days default)
- Admin can revoke sessions remotely
- Database-backed for advanced features

**PIM (Privileged Identity Management):**
- Just-In-Time (JIT) privilege elevation
- Time-limited elevation (30 min default)
- Automatic de-elevation on timeout
- Role assumption for admin users (board/arb)
- Full audit trail of elevation events

**Audit Logging:**
- All auth events logged (login, logout, password change)
- Authorization events (permission checks, access denials)
- Administrative events (role changes, user creation)
- Retention: 365 days for audit_logs, 730 days for security_events

---

## Running Migrations

### Local Development

```bash
# Run consolidated auth schema
npm run db:schema:auth:local

# Or directly with wrangler
npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-02-auth-sessions.sql

# Or run ALL schemas at once
npm run db:init:local
```

### Production

```bash
# Run consolidated auth schema
npm run db:schema:auth

# Or directly with wrangler
npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-02-auth-sessions.sql

# Or run ALL schemas at once
npm run db:init
```

### Using Helper Script

```bash
# Local
bash scripts/migrate-auth-all.sh local

# Remote
bash scripts/migrate-auth-all.sh remote
```

---

## Verification

After running the schema, verify tables exist:

```bash
# Local
npx wrangler d1 execute clrhoa_db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions', 'password_reset_tokens', 'password_setup_tokens', 'audit_logs', 'security_events', 'mfa_backup_codes', 'pim_elevation_logs') ORDER BY name;"

# Check sessions table structure (should include PIM columns)
npx wrangler d1 execute clrhoa_db --local --command="PRAGMA table_info(sessions);"
```

Expected tables:
- `sessions` (with PIM columns: elevated_until, assumed_role, assumed_at, assumed_until)
- `password_reset_tokens`
- `password_setup_tokens`
- `audit_logs`
- `security_events`
- `mfa_backup_codes`
- `pim_elevation_logs`

---

## Database Size Impact

**Estimated storage (1000 users):**
- Sessions: ~2 MB (avg 2 active sessions per user)
- Audit logs: ~10 MB (first year, depends on activity)
- Security events: ~1 MB (first year)
- Tokens: ~100 KB (active tokens only, cleaned up regularly)
- MFA backup codes: ~50 KB (only for users with MFA enabled)
- PIM elevation logs: ~500 KB (first year)

**Total:** ~14 MB for 1000 users (well within D1 free tier: 5 GB)

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

-- Clean up old PIM elevation logs (keep 1 year)
DELETE FROM pim_elevation_logs WHERE elevated_at < datetime('now', '-365 days');
```

---

## Legacy Migrations

The original incremental migration files have been **archived** to `scripts/archive/legacy-migrations/`:
- schema-auth-users-migration.sql
- schema-auth-password-tokens.sql
- schema-auth-sessions.sql
- schema-auth-audit-logs.sql
- schema-auth-security-events.sql
- schema-auth-mfa-backup-codes.sql
- schema-pim-elevation.sql
- schema-sessions-pim.sql

These files are preserved for historical reference and git history context.
**Do not use these files** - use the consolidated `schema-02-auth-sessions.sql` instead.

---

## Security Considerations

**What's in D1 (SQLite):**
- Password hashes (bcrypt, safe to store)
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

## Next Steps

After schema is deployed:

1. ✅ **Schema deployed** - All auth tables exist
2. ✅ **Lucia integration** - Session management implemented
3. ✅ **PIM framework** - Elevation columns added (flow needs implementation - see Issue #110)
4. 🔄 **Complete PIM** - Implement elevation UI and flow
5. 🔄 **MFA** - Implement TOTP enrollment and verification
6. 🔄 **Admin tools** - Session management, user administration

---

## Questions?

See consolidated schema documentation: `scripts/README.md`
See archived migrations: `scripts/archive/README.md`
