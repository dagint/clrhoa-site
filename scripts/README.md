# Database Migrations

## Consolidated Schema (Recommended)

The database schema is organized into **4 logical bundles** for easy management:

### 1. Core Schema (`schema-core.sql`)
**Foundation tables that everything depends on**

```bash
npm run db:schema:core:local   # Local development
npm run db:schema:core          # Production
```

**Includes:**
- `users` - User accounts with roles, contact info, and auth fields
- `owners` - Property directory with privacy settings
- `directory_logs` - Audit trail for contact access
- `login_history` - Session tracking

**Use cases:**
- Fresh database setup
- New development environment
- Core table structure changes

---

### 2. RBAC Schema (`schema-rbac.sql`)
**Role-Based Access Control & Route Permissions**

```bash
npm run db:schema:rbac:local   # Local development
npm run db:schema:rbac          # Production
```

**Includes:**
- `route_permissions` - Dynamic permission overrides

**Use cases:**
- Setting up access control
- Permission system changes
- RBAC updates

---

### 3. Features Schema (`schema-features.sql`)
**All application features and business logic**

```bash
npm run db:schema:features:local   # Local development
npm run db:schema:features          # Production
```

**Includes:**
- **ARB:** `arb_requests`, `arb_files` - Architectural review workflow
- **Meetings:** `meetings`, `meeting_rsvps` - Meeting scheduling
- **Maintenance:** `maintenance_requests` - Common area requests
- **Assessments:** `assessments`, `assessment_payments` - HOA dues (view-only)
- **Feedback:** `feedback_docs`, `feedback_responses` - Member feedback
- **Vendors:** `vendors` - Approved contractor directory

**Use cases:**
- Adding new features
- Feature table modifications
- Complete feature rollout

---

### 4. Auth Schema (`schema-auth.sql`)
**Password-based authentication & security**

```bash
npm run db:schema:auth:local   # Local development
npm run db:schema:auth          # Production
```

**Includes:**
- `password_reset_tokens` - Password reset flow
- `password_setup_tokens` - New user onboarding
- `sessions` - DB-backed session management
- `mfa_backup_codes` - MFA recovery codes
- `audit_logs` - Comprehensive security audit trail (365 day retention)
- `security_events` - Critical security monitoring (730 day retention)

**Use cases:**
- Implementing password-based auth
- Security auditing
- MFA setup
- Session management

---

## Quick Start

### Fresh Database Setup (All Schemas)

```bash
# Local development
npm run db:schema:all:local

# Production
npm run db:schema:all
```

This runs all 4 schemas in order: core → rbac → features → auth

---

### CI/CD (GitHub Actions)

The E2E test workflow uses the consolidated schemas:

```yaml
- name: Initialize local D1 database
  run: |
    npm run db:schema:core:local
    npm run db:schema:rbac:local
    npm run db:schema:features:local
    npm run db:schema:auth:local
```

**Benefits:**
- ✅ Clear and maintainable
- ✅ Easy to understand what's being installed
- ✅ Logical grouping by concern
- ✅ Fast execution (4 scripts vs 10+)

---

## Migration Strategy

### For Fresh Installs (New Environments)
Run all consolidated schemas in order:
```bash
npm run db:schema:all:local
```

### For Production Updates (Incremental Changes)
Use individual schemas as needed:
```bash
# Add new feature tables only
npm run db:schema:features

# Update auth system only
npm run db:schema:auth
```

### For Specific Column Additions
Use the legacy individual migration scripts (still available):
```bash
npm run db:owners-lot-number       # Add lot_number column
npm run db:phase35                  # Add phone/sms_optin to users
```

---

## Legacy Scripts (Deprecated)

The following scripts are **deprecated** in favor of consolidated schemas:

### Old Phased Approach ❌
```bash
db:init:local
db:phase3:local
db:owners-audit-contact:local
db:owners-created-at:local
db:owners-lot-number:local
db:owners-primary:local
db:phase35:local
db:phase4:local
db:phase5:local
db:route-permissions:local
```

### New Consolidated Approach ✅
```bash
db:schema:core:local
db:schema:rbac:local
db:schema:features:local
db:schema:auth:local
```

**Why consolidate?**
- Reduces 10+ scripts to 4 logical bundles
- Easier to understand dependencies
- Simpler CI/CD configuration
- Clearer separation of concerns
- Faster execution

---

## Schema Dependencies

```
schema-core.sql
  ↓
  ├── schema-rbac.sql (depends on users)
  ├── schema-features.sql (depends on users, owners)
  └── schema-auth.sql (depends on users)
```

**Always run `schema-core.sql` first!**

Other schemas can run in any order after core, but recommended order is:
1. Core (foundation)
2. RBAC (access control)
3. Features (business logic)
4. Auth (security)

---

## Troubleshooting

### "table users already exists"
This is **normal** for consolidated schemas with `CREATE TABLE IF NOT EXISTS`. The script is idempotent.

### "table users has no column named phone"
Run `schema-core.sql` which includes all user columns.

### "FOREIGN KEY constraint failed"
Ensure `schema-core.sql` ran first (creates parent tables: users, owners).

### E2E tests failing with missing columns
Check that CI workflow runs all 4 consolidated schemas:
```yaml
npm run db:schema:core:local
npm run db:schema:rbac:local
npm run db:schema:features:local
npm run db:schema:auth:local
```

---

## Future: Version-Tracked Migrations

For production-grade migration tracking, consider:

**Option A: Drizzle ORM**
```bash
npm install drizzle-orm drizzle-kit
npx drizzle-kit generate:sqlite
npx drizzle-kit push:sqlite
```

**Option B: Custom Migration Tracker**
```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Benefits:**
- Prevents duplicate migrations
- Tracks what's been applied
- Rollback support
- Automated migration ordering

Currently using **manual consolidation** (this approach) for simplicity.

---

## Contributing

When adding new tables:

1. Determine which bundle they belong to:
   - Core? (foundational user/owner data)
   - RBAC? (permissions/access control)
   - Features? (business logic/features)
   - Auth? (security/authentication)

2. Add to appropriate `schema-*.sql` file

3. Update this README

4. Test with `npm run db:schema:all:local`

5. Verify E2E tests pass in CI

---

## Questions?

See `/docs/AUTH_IMPLEMENTATION.md` for authentication architecture.
See `/tests/e2e/README.md` for E2E test setup.
