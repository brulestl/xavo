# Supabase Edge Function Cleanup Setup

This guide shows you how to deploy and schedule the conversation cleanup using Supabase Edge Functions.

## 🚀 Step 1: Deploy the Edge Function

### 1. Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link to your project
```bash
# In your project root directory
supabase link --project-ref YOUR_PROJECT_REF
```

### 4. Deploy the cleanup function
```bash
# Deploy the cleanup-conversations function
supabase functions deploy cleanup-conversations

# Or deploy all functions
supabase functions deploy
```

### 5. Set environment variables for the function
```bash
# Set the service role key for the function
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## 🧪 Step 2: Test the Function

### Test with dry run (recommended first)
```bash
# Replace YOUR_PROJECT_REF with your actual project reference
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations?dry_run=true&verbose=true" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Test actual cleanup
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"days_old": 30, "batch_size": 100, "verbose": true}'
```

## ⏰ Step 3: Schedule the Function

Since Supabase doesn't have built-in cron scheduling yet, here are the best options:

### Option A: GitHub Actions (Recommended)

Create `.github/workflows/cleanup-conversations.yml`:

```yaml
name: Daily Conversation Cleanup
on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Run Cleanup
        run: |
          curl -X POST "https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/cleanup-conversations" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"days_old": 30, "batch_size": 100, "verbose": true}'
```

**Required GitHub Secrets:**
- `SUPABASE_PROJECT_REF`: Your Supabase project reference
- `SUPABASE_ANON_KEY`: Your Supabase anon key

### Option B: External Cron Service

**Using cron-job.org (free online cron service):**

1. Go to https://cron-job.org
2. Create a new cron job:
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations`
   - **Method**: POST
   - **Headers**: 
     ```
     Authorization: Bearer YOUR_ANON_KEY
     Content-Type: application/json
     ```
   - **Body**: 
     ```json
     {"days_old": 30, "batch_size": 100}
     ```
   - **Schedule**: Daily at 2:00 AM

### Option C: Server Cron (if you have a server)

```bash
# Edit crontab
crontab -e

# Add this line for daily cleanup at 2 AM
0 2 * * * curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations" -H "Authorization: Bearer YOUR_ANON_KEY" -H "Content-Type: application/json" -d '{"days_old": 30, "batch_size": 100}' >> /var/log/cleanup.log 2>&1
```

### Option D: EasyCron (paid service with better reliability)

1. Go to https://www.easycron.com
2. Create a new cron job with the same settings as above
3. More reliable than free services

## 📊 Step 4: Monitor the Function

### Check function logs
```bash
# View recent function logs
supabase functions logs cleanup-conversations

# Follow logs in real-time
supabase functions logs cleanup-conversations --follow
```

### Test function manually
```bash
# Test in Supabase dashboard
# Go to Edge Functions → cleanup-conversations → Invoke

# Or use curl
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations?dry_run=true&verbose=true" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Monitor cleanup results in database
```sql
-- Check recent cleanup logs
SELECT * FROM conversation_cleanup_log 
ORDER BY cleanup_timestamp DESC 
LIMIT 10;

-- Check sessions scheduled for deletion
SELECT * FROM get_sessions_scheduled_for_deletion();

-- Monitor system health
SELECT 
  (SELECT COUNT(*) FROM active_conversation_sessions) as active_sessions,
  (SELECT COUNT(*) FROM conversation_sessions WHERE deleted_at IS NOT NULL) as scheduled_for_deletion,
  (SELECT SUM(sessions_deleted) FROM conversation_cleanup_log WHERE cleanup_timestamp > NOW() - INTERVAL '7 days') as cleaned_last_7_days;
```

## 🔧 Function Usage Examples

### Basic cleanup (default 30 days)
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Custom retention period (14 days)
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"days_old": 14, "batch_size": 50}'
```

### Dry run with verbose output
```bash
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations?dry_run=true&verbose=true" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Weekly cleanup with different settings
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-conversations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"days_old": 30, "batch_size": 200, "verbose": true}'
```

## 🛠️ Troubleshooting

### Function deployment issues
```bash
# Check function status
supabase functions list

# View deployment logs
supabase functions logs cleanup-conversations

# Redeploy if needed
supabase functions deploy cleanup-conversations --no-verify-jwt
```

### Permission issues
```bash
# Make sure service role key is set
supabase secrets list

# Set/update the service role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
```

### Testing locally
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test locally
curl -X POST "http://localhost:54321/functions/v1/cleanup-conversations?dry_run=true&verbose=true"
```

## 📝 Quick Setup Checklist

- [ ] Apply database migration (`api/database/add-soft-delete-migration.sql`)
- [ ] Deploy Edge Function (`supabase functions deploy cleanup-conversations`)
- [ ] Set service role key (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`)
- [ ] Test with dry run
- [ ] Set up scheduling (GitHub Actions, cron service, etc.)
- [ ] Monitor function logs
- [ ] Verify cleanup is working in database

## 🎯 Benefits of Edge Function Approach

- ✅ **Cloud-native**: Runs in Supabase's infrastructure
- ✅ **No server required**: No need to maintain your own server
- ✅ **Automatic scaling**: Supabase handles scaling
- ✅ **Direct database access**: Uses service role for full permissions
- ✅ **Integrated logging**: Built-in function logs in Supabase dashboard
- ✅ **Cost-effective**: Only pay for function execution time

Your cleanup system will now be fully automated and runs in the cloud alongside your data! 