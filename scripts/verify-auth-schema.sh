#!/bin/bash

# Verify auth schema migrations were applied correctly
# Usage:
#   Local:  ./scripts/verify-auth-schema.sh local
#   Remote: ./scripts/verify-auth-schema.sh remote

set -e

MODE=${1:-local}
DB_NAME="clrhoa_db"

if [ "$MODE" = "local" ]; then
  LOCAL_FLAG="--local"
  echo "Verifying auth schema in LOCAL mode..."
else
  LOCAL_FLAG=""
  echo "Verifying auth schema in REMOTE (production) mode..."
fi

echo ""
echo "=== Auth Schema Verification ==="
echo ""

# Check if all required tables exist
echo "Checking required tables..."
TABLES=$(npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'password_reset_tokens', 'password_setup_tokens', 'sessions', 'audit_logs', 'security_events', 'mfa_backup_codes') ORDER BY name;" --json)

EXPECTED_TABLES=("audit_logs" "mfa_backup_codes" "password_reset_tokens" "password_setup_tokens" "security_events" "sessions" "users")
FOUND_COUNT=$(echo "$TABLES" | grep -o '"name"' | wc -l)

if [ "$FOUND_COUNT" -eq 7 ]; then
  echo "✓ All 7 required tables exist"
else
  echo "✗ Expected 7 tables, found $FOUND_COUNT"
  echo "$TABLES"
  exit 1
fi

echo ""

# Check users table has new columns
echo "Checking users table columns..."
USERS_COLUMNS=$(npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --command="PRAGMA table_info(users);" --json)

REQUIRED_COLUMNS=("email" "role" "name" "created" "password_hash" "status" "mfa_enabled" "failed_login_attempts" "last_login" "phone")

for col in "${REQUIRED_COLUMNS[@]}"; do
  if echo "$USERS_COLUMNS" | grep -q "\"name\":\"$col\""; then
    echo "  ✓ Column '$col' exists"
  else
    echo "  ✗ Column '$col' missing"
    exit 1
  fi
done

echo ""

# Check indexes were created
echo "Checking indexes..."
INDEXES=$(npx wrangler d1 execute $DB_NAME $LOCAL_FLAG --command="SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%auth%' OR name LIKE 'idx_password%' OR name LIKE 'idx_session%' OR name LIKE 'idx_audit%' OR name LIKE 'idx_security%' OR name LIKE 'idx_mfa%' ORDER BY name;" --json)

INDEX_COUNT=$(echo "$INDEXES" | grep -o '"name"' | wc -l)

if [ "$INDEX_COUNT" -ge 15 ]; then
  echo "✓ Found $INDEX_COUNT auth indexes (expected 15+)"
else
  echo "✗ Expected 15+ indexes, found $INDEX_COUNT"
  echo "WARNING: Some indexes may be missing (query performance could be affected)"
fi

echo ""

# Test basic insert (local only)
if [ "$MODE" = "local" ]; then
  echo "Testing basic operations (local only)..."

  # Test audit log insert
  npx wrangler d1 execute $DB_NAME --local --command="INSERT INTO audit_logs (id, event_type, event_category, action, user_id) VALUES ('test-123', 'test_event', 'authentication', 'schema_verification_test', 'test@example.com');" > /dev/null 2>&1

  # Verify insert
  TEST_COUNT=$(npx wrangler d1 execute $DB_NAME --local --command="SELECT COUNT(*) as count FROM audit_logs WHERE id = 'test-123';" --json | grep -o '"count":[0-9]*' | cut -d: -f2)

  if [ "$TEST_COUNT" -eq 1 ]; then
    echo "  ✓ audit_logs table writable"
  else
    echo "  ✗ audit_logs table insert failed"
    exit 1
  fi

  # Clean up test data
  npx wrangler d1 execute $DB_NAME --local --command="DELETE FROM audit_logs WHERE id = 'test-123';" > /dev/null 2>&1
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "✓ Auth schema is correctly installed!"
echo ""
echo "Next steps:"
echo "  - Continue with PR #2: Audit Logging Infrastructure"
echo "  - Or review schema: ./scripts/AUTH_SCHEMA_README.md"
