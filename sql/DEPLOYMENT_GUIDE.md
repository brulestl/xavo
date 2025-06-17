# Daily Prompt Cap Deployment Guide

## Overview
This guide walks through deploying the daily prompt usage tracking system that enforces per-user daily limits on AI prompts.

## Prerequisites
- Access to your Supabase SQL Editor
- Backend server with `SUPABASE_SERVICE_ROLE_KEY` environment variable set

## Step-by-Step Deployment

### 1. Deploy the Database Table
Run this SQL in your Supabase SQL Editor:

```sql
-- File: sql/create_prompt_usage_table.sql
```

This creates:
- `prompt_usage` table to track daily usage per user
- RLS policies so users can only see their own data

### 2. Deploy the Consumption Function
Run this SQL in your Supabase SQL Editor:

```sql
-- File: sql/create_fn_consume_daily_function.sql
```

This creates:
- `fn_consume_daily(p_cap, p_user)` function that increments usage and enforces caps
- Grants execute permission to authenticated users

### 3. Deploy the Usage Check Function (Optional)
Run this SQL in your Supabase SQL Editor:

```sql
-- File: sql/create_get_daily_usage_function.sql
```

This creates:
- `fn_get_daily_usage(p_user)` function to check usage without consuming credits
- Useful for displaying usage info to users

### 4. Test the Functions
Run this SQL in your Supabase SQL Editor:

```sql
-- File: sql/test_prompt_usage.sql
-- NOTE: Replace 'test-user-id-here' with an actual UUID for testing
```

Expected test results:
- First 3 calls succeed (usage increments: 1, 2, 3)
- 4th call fails with "Daily prompt quota of 3 exceeded"

### 5. Restart Your Backend Server
The backend code is already updated to use these functions. Simply restart your NestJS server:

```bash
cd api
npm run start:dev
```

## How It Works

### Backend Integration
The `assertPromptCredit(userId, tier)` function in `api/src/utils/credits.ts`:
1. Gets the user's daily cap from their tier (`PLAN_LIMITS[tier].dailyPromptCap`)
2. Calls `fn_consume_daily(cap, userId)` 
3. If the user has exceeded their cap, the function throws an exception
4. If successful, the usage counter is incremented

### Current Plan Limits
- **Trial**: 3 prompts/day
- **Strategist**: 3 prompts/day  
- **Shark**: Unlimited (Number.MAX_SAFE_INTEGER)

### Usage Flow
1. User makes a request to `/api/v1/chat` 
2. `ChatController` calls `assertPromptCredit(user.id, tier)`
3. `fn_consume_daily` checks if user has remaining quota
4. If yes: increment counter and proceed
5. If no: throw exception with "Daily prompt quota exceeded" message

## Monitoring & Maintenance

### Check Daily Usage
Query the usage table:
```sql
SELECT user_id, usage_date, used 
FROM prompt_usage 
WHERE usage_date = current_date 
ORDER BY used DESC;
```

### Reset User's Daily Usage (if needed)
```sql
DELETE FROM prompt_usage 
WHERE user_id = 'user-uuid-here' 
  AND usage_date = current_date;
```

### View Historical Usage
```sql
SELECT user_id, usage_date, used 
FROM prompt_usage 
WHERE user_id = 'user-uuid-here'
ORDER BY usage_date DESC;
```

## Error Handling

### Common Errors
1. **"Could not find the function public.fn_consume_daily"**
   - Solution: Deploy the SQL functions to your database

2. **"SUPABASE_SERVICE_ROLE_KEY is required"**
   - Solution: Add service role key to your backend environment variables

3. **"Daily prompt quota of X exceeded"**
   - This is expected behavior when users hit their daily limit

### Troubleshooting
- Check server logs for detailed error messages
- Verify environment variables are loaded correctly
- Test SQL functions directly in Supabase SQL Editor
- Ensure RLS policies allow the operations you need

## Security Notes
- Functions use `security definer` so they run with elevated privileges
- RLS policies ensure users can only see their own usage data
- Service role key is used server-side for administrative operations
- Client-side code cannot directly manipulate usage counters 