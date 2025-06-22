# Soft Delete Implementation Guide - 30-Day Scheduled Deletion

This guide explains the new soft delete system for conversation sessions, which replaces immediate hard deletion with a 30-day scheduled deletion process.

## Overview

Instead of immediately deleting conversation sessions when users delete them in the UI, the system now:

1. **Soft deletes** sessions by setting `deleted_at` timestamp and `is_active = false`
2. **Schedules deletion** for 30 days later
3. **Automatically cleans up** expired sessions via automated scripts
4. **Allows restoration** within the 30-day window
5. **Logs all cleanup operations** for auditing

## Database Changes

### New Column
- Added `deleted_at TIMESTAMPTZ` column to `conversation_sessions` table

### New Indexes
- `idx_conversation_sessions_deleted_at` - For efficient queries on deleted sessions
- `idx_conversation_sessions_active_not_deleted` - Optimized index for active, non-deleted sessions

### New Database Functions

#### 1. `soft_delete_session(session_id, user_id)`
Marks a session for deletion without removing it immediately.

```sql
SELECT soft_delete_session('session-uuid', 'user-uuid');
-- Returns: true if successful, false if session not found
```

#### 2. `restore_deleted_session(session_id, user_id)`
Restores a soft-deleted session within the 30-day window.

```sql
SELECT restore_deleted_session('session-uuid', 'user-uuid');
-- Returns: true if restored, false if not found or expired
```

#### 3. `cleanup_old_conversations_with_logging(days_old, batch_size)`
Permanently deletes sessions that have been soft-deleted longer than specified days.

```sql
SELECT * FROM cleanup_old_conversations_with_logging(30, 100);
-- Returns: sessions_deleted, messages_deleted, contexts_deleted, cleanup_details
```

#### 4. `get_sessions_scheduled_for_deletion(user_id, days_remaining)`
Lists sessions scheduled for deletion.

```sql
SELECT * FROM get_sessions_scheduled_for_deletion('user-uuid', 30);
-- Returns: session details with deletion dates and countdown
```

### New Database View

#### `active_conversation_sessions`
A view that automatically excludes soft-deleted sessions.

```sql
-- Old way (now deprecated)
SELECT * FROM conversation_sessions WHERE is_active = true;

-- New way (recommended)
SELECT * FROM active_conversation_sessions;
```

### New Cleanup Log Table

`conversation_cleanup_log` tracks all cleanup operations:
- When cleanup ran
- How many records were deleted
- Execution time
- Detailed results

## Code Changes

### Backend Updates

#### 1. API Endpoints
All deletion endpoints now use soft delete:

```typescript
// Before (hard delete)
await supabase
  .from('conversation_sessions')
  .delete()
  .eq('id', sessionId);

// After (soft delete)
await supabase
  .rpc('soft_delete_session', { 
    p_session_id: sessionId, 
    p_user_id: userId 
  });
```

#### 2. Session Queries
All session listing queries now use the active view:

```typescript
// Before
await supabase
  .from('conversation_sessions')
  .select('*')
  .eq('is_active', true);

// After
await supabase
  .from('active_conversation_sessions')
  .select('*');
```

### Frontend Updates

#### 1. Delete Responses
The frontend now handles soft delete responses:

```typescript
// Response from soft delete
{
  message: 'Session scheduled for deletion in 30 days',
  deleted: true,
  deletion_scheduled: true
}
```

#### 2. UI Feedback
Users are informed that conversations are scheduled for deletion rather than immediately deleted.

## Automated Cleanup

### Cleanup Script

A Node.js script at `api/scripts/cleanup-deleted-sessions.js` handles automated cleanup:

```bash
# Basic usage (deletes sessions older than 30 days)
node api/scripts/cleanup-deleted-sessions.js

# Custom retention period
node api/scripts/cleanup-deleted-sessions.js --days=14

# Dry run (shows what would be deleted)
node api/scripts/cleanup-deleted-sessions.js --dry-run

# Verbose output
node api/scripts/cleanup-deleted-sessions.js --verbose

# Custom batch size
node api/scripts/cleanup-deleted-sessions.js --batch-size=50
```

### Environment Variables

The cleanup script requires:
```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# OR
SUPABASE_ANON_KEY=your-anon-key
```

### Cron Job Setup

#### Option 1: System Cron (Linux/macOS)
```bash
# Edit crontab
crontab -e

# Add this line to run daily at 2 AM
0 2 * * * cd /path/to/your/app && node api/scripts/cleanup-deleted-sessions.js >> /var/log/conversation-cleanup.log 2>&1

# Run weekly on Sundays at 3 AM
0 3 * * 0 cd /path/to/your/app && node api/scripts/cleanup-deleted-sessions.js --verbose >> /var/log/conversation-cleanup.log 2>&1
```

#### Option 2: PM2 Cron
```bash
# Install PM2 if not already installed
npm install -g pm2

# Create PM2 cron job
pm2 start api/scripts/cleanup-deleted-sessions.js --name "cleanup-conversations" --cron "0 2 * * *" --no-autorestart
```

#### Option 3: GitHub Actions (for cloud deployments)
```yaml
# .github/workflows/cleanup-conversations.yml
name: Cleanup Deleted Conversations
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node api/scripts/cleanup-deleted-sessions.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

#### Option 4: Supabase Edge Functions (Cloud Native)
Create a scheduled edge function that runs the cleanup:

```typescript
// supabase/functions/scheduled-cleanup/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data, error } = await supabase
    .rpc('cleanup_old_conversations_with_logging', { 
      days_old: 30,
      batch_size: 100
    })

  if (error) {
    console.error('Cleanup failed:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ 
    success: true, 
    result: data[0] 
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Then use Supabase's cron functionality to call it daily.

## Migration Instructions

### 1. Apply Database Migration

Run the migration SQL file in your Supabase SQL Editor:

```sql
-- Run api/database/add-soft-delete-migration.sql
```

### 2. Update Environment Variables

Add cleanup script environment variables:

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Set Up Automated Cleanup

Choose one of the cron job options above and implement it.

### 4. Test the System

```bash
# Test soft delete
SELECT soft_delete_session('test-session-id', 'test-user-id');

# Check scheduled deletions
SELECT * FROM get_sessions_scheduled_for_deletion();

# Test cleanup (dry run)
node api/scripts/cleanup-deleted-sessions.js --dry-run --verbose

# Test actual cleanup
SELECT * FROM cleanup_old_conversations_with_logging(0, 10); -- Delete sessions older than 0 days (for testing)
```

## Benefits

1. **Data Recovery**: Users can potentially recover accidentally deleted conversations
2. **Compliance**: Meets data retention requirements
3. **Performance**: Reduces database load from frequent hard deletes
4. **Auditing**: Complete log of all cleanup operations
5. **Flexibility**: Configurable retention periods
6. **Safety**: Dry-run capabilities for testing

## Monitoring

### Check Cleanup Logs
```sql
SELECT * FROM conversation_cleanup_log 
ORDER BY cleanup_timestamp DESC 
LIMIT 10;
```

### Monitor Sessions Scheduled for Deletion
```sql
SELECT 
  COUNT(*) as total_scheduled,
  MIN(days_until_deletion) as days_until_next_deletion,
  MAX(days_until_deletion) as days_until_last_deletion
FROM (
  SELECT 
    EXTRACT(DAYS FROM (deleted_at + INTERVAL '30 days' - NOW()))::INTEGER as days_until_deletion
  FROM conversation_sessions 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at > NOW() - INTERVAL '30 days'
) scheduled;
```

### Check System Health
```sql
-- Active sessions
SELECT COUNT(*) as active_sessions FROM active_conversation_sessions;

-- Scheduled for deletion
SELECT COUNT(*) as scheduled_for_deletion 
FROM conversation_sessions 
WHERE deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 days';

-- Already cleaned up (in logs)
SELECT SUM(sessions_deleted) as total_cleaned_up 
FROM conversation_cleanup_log 
WHERE cleanup_timestamp > NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Common Issues

1. **Cleanup script fails**: Check environment variables and Supabase permissions
2. **Sessions not being cleaned**: Verify cron job is running and script permissions
3. **Performance issues**: Adjust batch size in cleanup script
4. **View not updating**: Ensure RLS policies are correctly applied to the view

### Support Commands

```bash
# Check what would be cleaned
node api/scripts/cleanup-deleted-sessions.js --dry-run --verbose

# Manual cleanup with small batch
node api/scripts/cleanup-deleted-sessions.js --batch-size=10 --verbose

# Check cleanup history
SELECT * FROM conversation_cleanup_log ORDER BY cleanup_timestamp DESC LIMIT 5;
```

## Future Enhancements

1. **User notification**: Notify users before permanent deletion
2. **Bulk restoration**: Allow users to restore multiple sessions
3. **Variable retention**: Different retention periods per user tier
4. **Archive system**: Move very old sessions to cold storage instead of deleting
5. **Admin dashboard**: UI for monitoring and managing scheduled deletions 