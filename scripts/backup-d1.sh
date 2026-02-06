#!/bin/bash
# Backup script for Cloudflare D1 database
# Usage: ./scripts/backup-d1.sh [local|remote]

set -euo pipefail

ENV="${1:-remote}"

if [ "$ENV" = "local" ]; then
  echo "Creating local D1 backup..."
  npx wrangler d1 export clrhoa_db --local --output "backups/d1-backup-$(date +%Y%m%d-%H%M%S).sql"
elif [ "$ENV" = "remote" ]; then
  echo "Creating remote D1 backup..."
  npx wrangler d1 export clrhoa_db --remote --output "backups/d1-backup-$(date +%Y%m%d-%H%M%S).sql"
else
  echo "Usage: $0 [local|remote]"
  exit 1
fi

echo "Backup completed successfully!"
