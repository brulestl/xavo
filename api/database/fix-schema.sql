-- ===============================================================================
-- DATABASE SCHEMA FIX SCRIPT - Corporate Influence Coach
-- Run this script in your Supabase SQL Editor to fix all schema mismatches
-- ===============================================================================

-- Step 1: Create test user in auth.users to fix foreign key constraints
INSERT INTO auth.users (
  id, 
  email, 
  created_at, 
  updated_at,
  email_confirmed_at,
  instance_id,
  aud,
  role
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'test@influence.app',
  NOW(),
  NOW(), 
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Add created_at column to conversation_messages (for code compatibility)
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Update existing records to have created_at = message_timestamp
UPDATE conversation_messages 
SET created_at = message_timestamp 
WHERE created_at IS NULL;

-- Make created_at NOT NULL with a proper default
ALTER TABLE conversation_messages 
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN created_at SET DEFAULT NOW();

-- Step 3: Ensure conversation_sessions table has all required columns
-- Add missing columns if they don't exist
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Update any NULL values
UPDATE conversation_sessions 
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

UPDATE conversation_sessions 
SET is_active = COALESCE(is_active, true)
WHERE is_active IS NULL;

-- Step 4: Create indexes for conversation_sessions
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_message ON conversation_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_active ON conversation_sessions(is_active) WHERE is_active = true;

-- Step 5: Enable Row Level Security on conversation_sessions
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for conversation_sessions
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON conversation_sessions;

CREATE POLICY "Users can view their own sessions" ON conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON conversation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON conversation_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON conversation_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Step 7: Create function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 8: Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_conversation_sessions_updated_at ON conversation_sessions;
CREATE TRIGGER update_conversation_sessions_updated_at 
    BEFORE UPDATE ON conversation_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Create function to automatically update session activity when messages are added
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversation_sessions 
  SET 
    last_message_at = NEW.message_timestamp,
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$;

-- Step 10: Create trigger to automatically update session activity
DROP TRIGGER IF EXISTS trigger_update_session_activity ON conversation_messages;
CREATE TRIGGER trigger_update_session_activity
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Step 11: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON conversation_sessions TO authenticated;
GRANT ALL ON conversation_messages TO authenticated;

-- Step 12: Create a test session for verification (will be cleaned up later)
DO $$
DECLARE
  test_session_id UUID := gen_random_uuid();
  test_user_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  RAISE NOTICE 'Creating test session with ID: %', test_session_id;
  
  -- Insert test session (using only essential columns)
  INSERT INTO conversation_sessions (
    id,
    user_id,
    title,
    created_at,
    last_message_at,
    message_count
  ) VALUES (
    test_session_id,
    test_user_id,
    'Test Session - Will be deleted',
    NOW(),
    NOW(),
    0
  );
  
  RAISE NOTICE 'Test session created successfully';
  
  -- Insert test message
  INSERT INTO conversation_messages (
    session_id,
    user_id,
    role,
    content,
    message_timestamp,
    created_at
  ) VALUES (
    test_session_id,
    test_user_id,
    'user',
    'Test message to verify schema works',
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Test message created successfully';
  
  -- Clean up test data
  DELETE FROM conversation_sessions WHERE id = test_session_id;
  
  RAISE NOTICE 'Test data cleaned up successfully';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ Schema fix completed successfully!';
  RAISE NOTICE '✅ Test user created: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  RAISE NOTICE '✅ All tables and triggers are properly configured.';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'You can now restart your backend server and conversations will persist!';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Schema fix encountered an error: %', SQLERRM;
    RAISE NOTICE '🧹 Cleaning up any test data that might have been created...';
    -- Clean up any test data that might have been created
    BEGIN
      DELETE FROM conversation_sessions WHERE id = test_session_id;
    EXCEPTION 
      WHEN OTHERS THEN 
        RAISE NOTICE 'Note: Could not clean up test session (this is usually fine)';
    END;
    RAISE;
END $$;

-- Step 13: Display current table status
SELECT 
  'conversation_sessions' as table_name,
  COUNT(*) as row_count,
  'Ready for use' as status
FROM conversation_sessions
UNION ALL
SELECT 
  'conversation_messages' as table_name,
  COUNT(*) as row_count,
  'Ready for use' as status  
FROM conversation_messages
UNION ALL
SELECT 
  'auth.users' as table_name,
  COUNT(*) as row_count,
  'Test user available' as status
FROM auth.users
WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; 