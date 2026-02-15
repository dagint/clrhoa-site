#!/bin/bash
# Apply PIM elevation log table migration
# Usage: ./scripts/apply-pim-migration.sh [local|remote]

set -e

ENVIRONMENT=${1:-remote}
MIGRATION_FILE="scripts/migrations/add-pim-elevation-log-table.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PIM Elevation Log Table Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Migration:   $MIGRATION_FILE"
echo ""

if [ "$ENVIRONMENT" != "local" ] && [ "$ENVIRONMENT" != "remote" ]; then
    echo "❌ Error: Environment must be 'local' or 'remote'"
    echo "Usage: $0 [local|remote]"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration preview:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
head -20 "$MIGRATION_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$ENVIRONMENT" = "remote" ]; then
    echo "⚠️  WARNING: This will apply the migration to PRODUCTION!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirmation
    if [ "$confirmation" != "yes" ]; then
        echo "❌ Migration cancelled"
        exit 0
    fi
    echo ""
fi

echo "🔄 Applying migration..."
wrangler d1 execute clrhoa_db --$ENVIRONMENT --file="$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "🔍 Verifying table exists..."
    wrangler d1 execute clrhoa_db --$ENVIRONMENT --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='pim_elevation_log';"
    echo ""
    echo "✅ Done! The pim_elevation_log table is now available."
else
    echo ""
    echo "❌ Migration failed. Check the error above."
    exit 1
fi
