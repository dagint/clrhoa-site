#!/bin/bash
# Download all R2 files using wrangler
# This creates a local backup of all uploaded HOA files

BACKUP_DIR="$HOME/clrhoa-r2-backup-$(date +%Y%m%d)"
BUCKET="clrhoa-files"

echo "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

echo "Downloading all files from R2 bucket: $BUCKET"
echo "This may take a while depending on the number of files..."

# Use wrangler to list and download files
# Note: This requires wrangler to be configured with your Cloudflare account

npx wrangler r2 object list "$BUCKET" --json > "$BACKUP_DIR/file-list.json"

# Parse and download each file
node -e "
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const list = JSON.parse(fs.readFileSync('$BACKUP_DIR/file-list.json', 'utf8'));

(async () => {
  for (const file of list) {
    if (!file.key) continue;
    // Skip backup folder to avoid recursive backup
    if (file.key.startsWith('backups/')) continue;

    const localPath = '$BACKUP_DIR/' + file.key;
    const dir = localPath.substring(0, localPath.lastIndexOf('/'));

    // Create directory if needed
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log('Downloading: ' + file.key);
    try {
      await execAsync(\`npx wrangler r2 object get $BUCKET/\${file.key} --file=\${localPath}\`);
    } catch (err) {
      console.error('Failed to download ' + file.key + ':', err.message);
    }
  }
  console.log('Backup complete: $BACKUP_DIR');
})();
"
