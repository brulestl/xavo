#!/bin/bash

# Conversation Session Cleanup Cron Job Script
# This script runs the automated cleanup for soft-deleted conversation sessions
# 
# Usage in crontab:
# 0 2 * * * /path/to/your/app/cron-cleanup-example.sh >> /var/log/conversation-cleanup.log 2>&1

# Configuration
APP_DIR="/path/to/your/app"  # Change this to your actual app directory
NODE_PATH="/usr/local/bin/node"  # Change this to your node path (run 'which node' to find it)
RETENTION_DAYS=30
BATCH_SIZE=100

# Load environment variables (if using .env file)
if [ -f "$APP_DIR/.env" ]; then
    export $(cat "$APP_DIR/.env" | xargs)
fi

# Ensure required environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Change to app directory
cd "$APP_DIR" || exit 1

# Log start
echo "🧹 Starting conversation cleanup at $(date)"
echo "📂 Working directory: $(pwd)"
echo "⚙️  Configuration: ${RETENTION_DAYS} days retention, ${BATCH_SIZE} batch size"

# Run the cleanup script
$NODE_PATH api/scripts/cleanup-deleted-sessions.js \
    --days=$RETENTION_DAYS \
    --batch-size=$BATCH_SIZE \
    --verbose

# Check exit code
if [ $? -eq 0 ]; then
    echo "✅ Cleanup completed successfully at $(date)"
else
    echo "❌ Cleanup failed at $(date)"
    exit 1
fi

echo "🏁 Cleanup job finished at $(date)"
echo "----------------------------------------" 