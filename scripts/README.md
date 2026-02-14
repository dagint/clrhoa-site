# CLRHOA Database Schema

This directory contains the **consolidated database schema** for the CLRHOA Portal. These 5 files represent the complete state of all 52 tables including all incremental migrations.

## Schema Files (Execute in Order)

1. **schema-01-core.sql** - Foundation tables
   - users (with all auth fields)
   - owners (with phone2, phone3, audit fields)
   - directory_logs (with email, IP, role tracking)
   - login_history

2. **schema-02-auth-sessions.sql** - Authentication & Sessions
   - sessions (Lucia v3 with PIM columns: elevated_until, assumed_role, etc.)
   - password_reset_tokens
   - password_setup_tokens
   - mfa_backup_codes
   - audit_logs
   - security_events
   - pim_elevation_logs

3. **schema-03-features.sql** - Application Features (24+ tables)
   - ARB tables (arb_requests with ALL v2-v8 columns, arb_files, arb_audit_log, arc_request_votes, arb_notification_debounce)
   - Electronic signatures (electronic_signatures, esignature_audit_log)
   - Meetings (meetings with post_to_public_news, meeting_rsvps)
   - Maintenance (maintenance_requests)
   - Assessments (assessments, assessment_payments, special_assessments)
   - Feedback (feedback_docs, feedback_responses, site_feedback)
   - Vendors (vendors, vendor_submissions, vendor_audit_log)
   - News (news_items with image fields)
   - Documents (public_documents, member_documents)
   - Preapproval (preapproval_items)
   - Contact (contact_submissions)
   - Notifications (notification_types, user_notifications, notification_dismissals, sms_feature_requests)

4. **schema-04-admin-compliance.sql** - Admin & Compliance
   - RBAC (route_permissions)
   - Compliance (compliance_requirements, compliance_documents, compliance_audit_log)
   - Backups (backup_config)
   - Analytics (page_views, signature_analytics, arb_analytics, daily_stats)
   - Admin Logs (owner_contact_audit_log, assumed_role_audit_log)

5. **schema-05-seed-data.sql** - Initial Data
   - 15 Florida HOA compliance requirements (§720.303(4))
   - 4 public document placeholders (bylaws, covenants, proxy, ARB form)
   - Default backup configuration

## Quick Start

### Initialize Fresh Database
```bash
# Local
for f in scripts/schema-0*.sql; do
  npx wrangler d1 execute clrhoa_db --local --file="$f"
done

# Remote
for f in scripts/schema-0*.sql; do
  npx wrangler d1 execute clrhoa_db --remote --file="$f"
done
```

### Individual File Execution
```bash
# Local
npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-01-core.sql
npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-02-auth-sessions.sql
npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-03-features.sql
npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-04-admin-compliance.sql
npx wrangler d1 execute clrhoa_db --local --file=./scripts/schema-05-seed-data.sql

# Remote
npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-01-core.sql
npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-02-auth-sessions.sql
npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-03-features.sql
npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-04-admin-compliance.sql
npx wrangler d1 execute clrhoa_db --remote --file=./scripts/schema-05-seed-data.sql
```

## Verification

After running schemas, verify with:
```bash
# Check tables exist (should show 52 tables)
npx wrangler d1 execute clrhoa_db --remote --command="SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"

# Check specific table structure
npx wrangler d1 execute clrhoa_db --remote --command="PRAGMA table_info(sessions)"
npx wrangler d1 execute clrhoa_db --remote --command="PRAGMA table_info(arb_requests)"
```

## Benefits

1. **Single Source of Truth** - 5 files instead of 83+ fragmented migrations
2. **Idempotent** - Safe to run multiple times (uses `CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`)
3. **Complete** - Each file represents the FINAL state of all tables with all columns
4. **Documented** - Extensive comments explaining features and compliance requirements
5. **Fast** - Execute all schemas in ~15 seconds

## Archived Migrations

The original 81 incremental migration files have been archived to `archive/legacy-migrations/` for historical reference. See `archive/README.md` for details.

**Do not use archived files** - they are preserved for git history context only.

## Maintenance

When adding new features:

1. **For existing databases**: Create an incremental migration file (e.g., `schema-new-feature.sql`)
2. **Update consolidated file**: Add the new columns/tables to the appropriate consolidated schema
3. **Run on remote**: Execute the incremental migration on remote database
4. **Archive old migration**: Move to `archive/legacy-migrations/` if desired

This ensures both incremental updates (for existing databases) and consolidated schemas (for fresh installs) stay in sync.

## What Was Consolidated

These 5 files consolidate 81 incremental migrations including:

- **ARB workflow**: 13 files (v2-v8, voting, audit, e-signatures)
- **Auth & Sessions**: 8 files (PIM, password tokens, MFA, audit logs)
- **Core tables**: 10 files (owners, directory logs, login history)
- **Features**: 25+ files (vendors, news, documents, assessments, notifications)
- **Admin/Compliance**: 15+ files (RBAC, compliance tracking, analytics, backups)
- **Seed data**: Initial compliance requirements and config

See `archive/legacy-migrations/` for the complete list.
