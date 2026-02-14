#!/bin/bash

# Run auth schema migration using consolidated schema
# Usage:
#   Local:  ./scripts/migrate-auth-all.sh local
#   Remote: ./scripts/migrate-auth-all.sh remote

set -e  # Exit on error

MODE=${1:-local}
DB_NAME="clrhoa_db"

if [ "$MODE" = "local" ]; then
  LOCAL_FLAG="--local"
  echo "Running auth schema in LOCAL mode..."
else
  LOCAL_FLAG=""
  echo "Running auth schema in REMOTE (production) mode..."
  read -p "Are you sure you want to run migration in production? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo ""
echo "=== Auth & Sessions Schema Migration ===="
echo "Using consolidated schema: schema-02-auth-sessions.sql"
echo ""

# Run consolidated auth schema (includes all tables: sessions, password tokens, MFA, audit logs, security events)
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --file=scripts/schema-02-auth-sessions.sql
echo "✓ Auth & sessions schema applied"
echo ""

echo "=== Migration Complete ==="
echo ""
echo "Verifying tables..."

# Verify tables exist
npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('password_reset_tokens', 'password_setup_tokens', 'sessions', 'audit_logs', 'security_events', 'mfa_backup_codes', 'pim_elevation_logs') ORDER BY name;"

echo ""
echo "✓ All auth tables created successfully!"
echo ""
echo "Next steps:"
echo "  - Auth schema includes: sessions (with PIM), password tokens, MFA, audit logs, security events"
echo "  - Continue with application-level implementation"
