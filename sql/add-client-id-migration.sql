-- Migration: Add client_id column for message deduplication
-- This implements the idempotency solution to prevent duplicate messages

-- Step 1: Add client_id column to conversation_messages table
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS client_id UUID;

-- Step 2: Backfill existing messages with generated client_ids
-- This ensures existing data doesn't break the unique constraint
UPDATE conversation_messages 
SET client_id = gen_random_uuid() 
WHERE client_id IS NULL;

-- Step 3: Make client_id NOT NULL now that all rows have values
ALTER TABLE conversation_messages 
ALTER COLUMN client_id SET NOT NULL;

-- Step 4: Create unique index on client_id to prevent duplicate messages
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_client_id 
ON conversation_messages(client_id);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN conversation_messages.client_id IS 'Unique client identifier for message deduplication and idempotency';

-- Verify the migration
SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT client_id) as unique_client_ids,
    COUNT(*) FILTER (WHERE client_id IS NULL) as null_client_ids
FROM conversation_messages;

-- Expected result: total_messages = unique_client_ids, null_client_ids = 0 