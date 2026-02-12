#!/bin/bash
# View the latest R2 backup manifest

DATE=${1:-$(date +%Y-%m-%d)}

echo "📦 Fetching R2 backup manifest for $DATE..."
echo ""

# Download manifest
npx wrangler r2 object get clrhoa-files/backups/r2/$DATE/manifest.json --file /tmp/manifest.json 2>/dev/null

if [ -f /tmp/manifest.json ]; then
  echo "✅ Manifest found!"
  echo ""
  echo "📊 Summary:"
  jq '{date, total_files, total_bytes_mb: (.total_bytes / 1024 / 1024 | floor)}' /tmp/manifest.json
  echo ""
  echo "📁 Sample files (first 5):"
  jq -r '.files[:5] | .[] | "  - \(.key) (\(.size | tonumber / 1024 | floor)KB)"' /tmp/manifest.json
  echo ""
  echo "💾 Full manifest available at: /tmp/manifest.json"
  rm /tmp/manifest.json
else
  echo "❌ No backup found for $DATE"
  echo "Available backups:"
  npx wrangler r2 object list clrhoa-files --prefix backups/r2/ 2>/dev/null | grep manifest.json || echo "  None found"
fi
