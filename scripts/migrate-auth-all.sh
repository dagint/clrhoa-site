#!/bin/bash

# Run all auth schema migrations in the correct order
# Usage:
#   Local:  ./scripts/migrate-auth-all.sh local
#   Remote: ./scripts/migrate-auth-all.sh remote

set -e  # Exit on error

MODE=${1:-local}
DB_NAME="clrhoa_db"

if [ "$MODE" = "local" ]; then
  LOCAL_FLAG="--local"
  echo "Running auth migrations in LOCAL mode..."
else
  LOCAL_FLAG=""
  echo "Running auth migrations in REMOTE (production) mode..."
  read -p "Are you sure you want to run migrations in production? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo ""
echo "=== Auth Schema Migration Phase 1 ==="
echo ""

# Migration 1: Users table
echo "[1/6] Migrating users table..."
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --file=scripts/schema-auth-users-migration.sql
echo "✓ Users table migrated"
echo ""

# Migration 2: Password tokens
echo "[2/6] Creating password token tables..."
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --file=scripts/schema-auth-password-tokens.sql
echo "✓ Password token tables created"
echo ""

# Migration 3: Sessions
echo "[3/6] Creating sessions table..."
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --file=scripts/schema-auth-sessions.sql
echo "✓ Sessions table created"
echo ""

# Migration 4: Audit logs
echo "[4/6] Creating audit logs table..."
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --file=scripts/schema-auth-audit-logs.sql
echo "✓ Audit logs table created"
echo ""

# Migration 5: Security events
echo "[5/6] Creating security events table..."
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --file=scripts/schema-auth-security-events.sql
echo "✓ Security events table created"
echo ""

# Migration 6: MFA backup codes
echo "[6/6] Creating MFA backup codes table..."
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --file=scripts/schema-auth-mfa-backup-codes.sql
echo "✓ MFA backup codes table created"
echo ""

echo "=== Migration Complete ==="
echo ""
echo "Verifying tables..."

# Verify tables exist
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('password_reset_tokens', 'password_setup_tokens', 'sessions', 'audit_logs', 'security_events', 'mfa_backup_codes') ORDER BY name;"

echo ""
echo "✓ All auth tables created successfully!"
echo ""
echo "Next steps:"
echo "  1. Verify schema with: npm run db:verify:auth:$MODE"
echo "  2. Continue with PR #2 (Audit Logging Infrastructure)"
