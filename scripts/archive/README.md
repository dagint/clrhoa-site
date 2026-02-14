# Legacy Schema Migrations Archive

This directory contains the original 83+ incremental schema migration files that were used during development.

## History

These files were created incrementally as features were added to the CLRHOA Portal:
- Initial schema setup (Phase 1-6)
- ARB workflow enhancements (v2-v8)
- PIM (Privileged Identity Management) additions
- Compliance tracking (Florida Statute 720.303(4))
- Analytics and audit logging
- Various feature-specific migrations

## Current Schema

As of February 2026, all these migrations have been **consolidated** into 5 schema files in the parent `scripts/` directory:

1. **schema-01-core.sql** - Foundation tables
2. **schema-02-auth-sessions.sql** - Authentication & sessions
3. **schema-03-features.sql** - Application features
4. **schema-04-admin-compliance.sql** - Admin & compliance
5. **schema-05-seed-data.sql** - Initial data

The consolidated files represent the **final state** of all tables and should be used for:
- New development environments
- Fresh database initialization
- Schema reference and documentation

## Preservation

These legacy files are preserved for:
- Historical reference
- Understanding schema evolution
- Git history context
- Debugging migration-related issues

## Do Not Use

⚠️ **Do not use these files for new databases.** Use the consolidated schema files in the parent directory instead.

If you need to understand how a specific feature evolved, review git history:
```bash
git log --follow scripts/archive/legacy-migrations/schema-arb-v*.sql
```
