-- Corporate Influence Coach - Supabase Database Schema
-- This file contains the database schema for RAG and memory functionality

-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create conversation sessions table
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB
);

-- Create conversation messages table with vector embeddings
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  action_type TEXT,
  metadata JSONB,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_count INTEGER,
  message_timestamp TIMESTAMPTZ DEFAULT NOW(),
  raw_response JSONB
);

-- Create user profiles table for personalization
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB,
  work_context JSONB,
  communication_style JSONB,
  frequent_topics TEXT[],
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create short-term contexts table for conversation summaries
CREATE TABLE IF NOT EXISTS short_term_contexts (
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

-- Create long-term memories table for persistent insights
CREATE TABLE IF NOT EXISTS long_term_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_title TEXT NOT NULL,
  memory_content TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('pattern', 'insight', 'preference', 'goal', 'challenge')),
  topics TEXT[] DEFAULT '{}',
  scenarios TEXT[] DEFAULT '{}',
  source_session_ids UUID[] DEFAULT '{}',
  source_message_count INTEGER DEFAULT 0,
  confidence_score NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  memory_embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create message_timestamp column if it doesn't exist (for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'message_timestamp'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN message_timestamp TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add raw_response column to store full OpenAI response payloads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'raw_response'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN raw_response JSONB;
  END IF;
END $$;

-- Ensure context_embedding column exists in short_term_contexts (it should from the table creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'short_term_contexts' AND column_name = 'context_embedding'
  ) THEN
    ALTER TABLE short_term_contexts ADD COLUMN context_embedding vector(1536);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_message ON conversation_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_active ON conversation_sessions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_id ON conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id ON conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_role ON conversation_messages(role);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_action_type ON conversation_messages(action_type);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(message_timestamp DESC);

-- Indexes for short_term_contexts table
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_session_id ON short_term_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_user_id ON short_term_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_created_at ON short_term_contexts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_version ON short_term_contexts(session_id, summary_version DESC);
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_weight ON short_term_contexts(context_weight DESC);

-- Indexes for long_term_memories table
CREATE INDEX IF NOT EXISTS idx_long_term_memories_user_id ON long_term_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_type ON long_term_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_created_at ON long_term_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_confidence ON long_term_memories(confidence_score DESC);

-- Vector similarity search index using HNSW for new tables
CREATE INDEX IF NOT EXISTS idx_short_term_contexts_embedding 
ON short_term_contexts 
USING hnsw (context_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_long_term_memories_embedding 
ON long_term_memories 
USING hnsw (memory_embedding vector_cosine_ops);

-- Vector similarity search index using HNSW
CREATE INDEX IF NOT EXISTS idx_conversation_messages_embedding 
ON conversation_messages 
USING hnsw (embedding vector_cosine_ops);

-- Row Level Security (RLS) policies
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_term_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_term_memories ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_sessions
CREATE POLICY "Users can view their own sessions" ON conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON conversation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON conversation_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON conversation_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for conversation_messages
CREATE POLICY "Users can view their own messages" ON conversation_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON conversation_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON conversation_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON conversation_messages
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for short_term_contexts
CREATE POLICY "Users can view their own contexts" ON short_term_contexts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contexts" ON short_term_contexts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contexts" ON short_term_contexts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contexts" ON short_term_contexts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for long_term_memories
CREATE POLICY "Users can view their own memories" ON long_term_memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories" ON long_term_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories" ON long_term_memories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories" ON long_term_memories
  FOR DELETE USING (auth.uid() = user_id);

-- Functions for vector similarity search
CREATE OR REPLACE FUNCTION search_similar_messages(
  query_embedding vector(1536),
  user_id UUID,
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  exclude_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  user_id UUID,
  role TEXT,
  content TEXT,
  action_type TEXT,
  metadata JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ,
  token_count INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.session_id,
    cm.user_id,
    cm.role,
    cm.content,
    cm.action_type,
    cm.metadata,
    cm.embedding,
    cm.created_at,
    cm.token_count,
    (1 - (cm.embedding <=> query_embedding)) AS similarity
  FROM conversation_messages cm
  WHERE 
    cm.user_id = search_similar_messages.user_id
    AND cm.embedding IS NOT NULL
    AND (1 - (cm.embedding <=> query_embedding)) > similarity_threshold
    AND (exclude_session_id IS NULL OR cm.session_id != exclude_session_id)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE conversation_sessions 
  SET message_count = message_count + 1
  WHERE id = session_id
  RETURNING message_count INTO new_count;
  
  RETURN COALESCE(new_count, 0);
END;
$$;

-- Function to automatically update session activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversation_sessions 
  SET 
    last_message_at = NEW.created_at,
    message_count = message_count + 1
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically update session activity when messages are inserted
CREATE TRIGGER trigger_update_session_activity
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Function to clean up old conversations (optional)
CREATE OR REPLACE FUNCTION cleanup_old_conversations(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM conversation_sessions 
  WHERE last_message_at < NOW() - INTERVAL '1 day' * days_old
    AND is_active = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$; 