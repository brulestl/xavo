-- Enhanced Memory System Schema Updates
-- Apply these changes to add raw response storage and embedding support

-- Add raw_response column to conversation_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'conversation_messages' 
      AND column_name = 'raw_response'
  ) THEN
    ALTER TABLE public.conversation_messages ADD COLUMN raw_response JSONB;
    RAISE NOTICE 'Added raw_response column to conversation_messages';
  ELSE
    RAISE NOTICE 'raw_response column already exists in conversation_messages';
  END IF;
END $$;

-- Ensure message_timestamp column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'conversation_messages' 
      AND column_name = 'message_timestamp'
  ) THEN
    ALTER TABLE public.conversation_messages ADD COLUMN message_timestamp TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added message_timestamp column to conversation_messages';
  ELSE
    RAISE NOTICE 'message_timestamp column already exists in conversation_messages';
  END IF;
END $$;

-- Verify short_term_contexts table exists with all required columns
CREATE TABLE IF NOT EXISTS public.short_term_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  key_topics TEXT[] DEFAULT '{}',
  message_start_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
  message_end_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  summary_version INTEGER NOT NULL DEFAULT 1,
  context_weight NUMERIC(3,2) DEFAULT 0.5 CHECK (context_weight >= 0 AND context_weight <= 1),
  context_embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_raw_response ON conversation_messages USING gin(raw_response);

CREATE INDEX IF NOT EXISTS idx_short_term_contexts_session_id ON short_term_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_user_id ON short_term_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_created_at ON short_term_contexts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_version ON short_term_contexts(session_id, summary_version DESC);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_weight ON short_term_contexts(context_weight DESC);

-- Vector similarity search index using HNSW
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_embedding 
ON short_term_contexts 
USING hnsw (context_embedding vector_cosine_ops);

-- Enable RLS on short_term_contexts if not already enabled
ALTER TABLE short_term_contexts ENABLE ROW LEVEL SECURITY;

-- RLS policies for short_term_contexts if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'short_term_contexts' 
      AND policyname = 'Users can view their own contexts'
  ) THEN
    CREATE POLICY "Users can view their own contexts" ON short_term_contexts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'short_term_contexts' 
      AND policyname = 'Users can insert their own contexts'
  ) THEN
    CREATE POLICY "Users can insert their own contexts" ON short_term_contexts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'short_term_contexts' 
      AND policyname = 'Users can update their own contexts'
  ) THEN
    CREATE POLICY "Users can update their own contexts" ON short_term_contexts
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'short_term_contexts' 
      AND policyname = 'Users can delete their own contexts'
  ) THEN
    CREATE POLICY "Users can delete their own contexts" ON short_term_contexts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Update existing conversation_messages records to have message_timestamp if null
UPDATE conversation_messages 
SET message_timestamp = created_at 
WHERE message_timestamp IS NULL;

-- Ensure context_embedding column exists in short_term_contexts (it should from the table creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'short_term_contexts' 
      AND column_name = 'context_embedding'
  ) THEN
    ALTER TABLE short_term_contexts ADD COLUMN context_embedding vector(1536);
    RAISE NOTICE 'Added context_embedding column to short_term_contexts';
  ELSE
    RAISE NOTICE 'context_embedding column already exists in short_term_contexts';
  END IF;
END $$;

-- Final verification
DO $$
DECLARE
  raw_response_exists BOOLEAN;
  message_timestamp_exists BOOLEAN;
  short_term_table_exists BOOLEAN;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'conversation_messages' 
      AND column_name = 'raw_response'
  ) INTO raw_response_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'conversation_messages' 
      AND column_name = 'message_timestamp'
  ) INTO message_timestamp_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public'
      AND table_name = 'short_term_contexts'
  ) INTO short_term_table_exists;

  -- Report results
  RAISE NOTICE '=== Enhanced Memory System Schema Status ===';
  RAISE NOTICE 'raw_response column: %', CASE WHEN raw_response_exists THEN '✅ Present' ELSE '❌ Missing' END;
  RAISE NOTICE 'message_timestamp column: %', CASE WHEN message_timestamp_exists THEN '✅ Present' ELSE '❌ Missing' END;
  RAISE NOTICE 'short_term_contexts table: %', CASE WHEN short_term_table_exists THEN '✅ Present' ELSE '❌ Missing' END;
  RAISE NOTICE '============================================';
END $$; 