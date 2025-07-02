# 🚀 Database Migration Instructions

## Run the Client ID Migration

To implement the duplicate message prevention system, you need to run the database migration:

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `sql/add-client-id-migration.sql`
4. Paste and run the migration
5. Verify the results show `total_messages = unique_client_ids` and `null_client_ids = 0`

### Option 2: Supabase CLI

```bash
# Run the migration file
supabase db push sql/add-client-id-migration.sql

# Or run directly
psql "$DATABASE_URL" -f sql/add-client-id-migration.sql
```

### Verification

After running the migration, verify it worked:

```sql
-- Check the table structure
\d conversation_messages

-- Verify all messages have client_ids
SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT client_id) as unique_client_ids,
    COUNT(*) FILTER (WHERE client_id IS NULL) as null_client_ids
FROM conversation_messages;
```

Expected output:
- `total_messages` = `unique_client_ids` 
- `null_client_ids` = 0
- New column `client_id UUID NOT NULL` visible

## Testing the Solution

After migration, test double-tap prevention:

1. **Deploy the updated code** (client + edge function)
2. **Open the app** and try rapid double-tapping the send button
3. **Check console logs** for `🚫 Duplicate message blocked` messages
4. **Verify database** - only one row should exist per logical message

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Remove the unique constraint
DROP INDEX IF EXISTS idx_conversation_messages_client_id;

-- Remove the column
ALTER TABLE conversation_messages DROP COLUMN IF EXISTS client_id;
```

## Success Indicators

✅ **Console logs show**: `🚫 Duplicate message blocked`  
✅ **Database**: No duplicate messages even with rapid tapping  
✅ **UI**: Send button properly disabled during transmission  
✅ **Edit flow**: No duplicate user messages when editing  

The duplicate prevention system is now active! 🎉 