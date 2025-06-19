-- Corporate Influence Coach Corpus - Vector Database Schema
-- This creates the table and functions for storing and retrieving coach training data

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create coach corpus table for training data embeddings
CREATE TABLE IF NOT EXISTS coach_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
  tags TEXT[],
  source TEXT,
  speaker TEXT,
  original_id TEXT, -- From JSONL file
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_count INTEGER
);

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_coach_corpus_embedding 
ON coach_corpus 
USING hnsw (embedding vector_cosine_ops);

-- Create additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_coach_corpus_source ON coach_corpus(source);
CREATE INDEX IF NOT EXISTS idx_coach_corpus_tags ON coach_corpus USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_coach_corpus_created_at ON coach_corpus(created_at DESC);

-- Function to search similar coach corpus content
CREATE OR REPLACE FUNCTION match_coach_corpus(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5,
  source_filter TEXT DEFAULT NULL,
  tag_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  chunk TEXT,
  embedding VECTOR(1536),
  tags TEXT[],
  source TEXT,
  speaker TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.chunk,
    cc.embedding,
    cc.tags,
    cc.source,
    cc.speaker,
    cc.metadata,
    cc.created_at,
    (1 - (cc.embedding <=> query_embedding)) AS similarity
  FROM coach_corpus cc
  WHERE 
    cc.embedding IS NOT NULL
    AND (1 - (cc.embedding <=> query_embedding)) > match_threshold
    AND (source_filter IS NULL OR cc.source = source_filter)
    AND (tag_filter IS NULL OR tag_filter = ANY(cc.tags))
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to get corpus statistics
CREATE OR REPLACE FUNCTION get_coach_corpus_stats()
RETURNS TABLE (
  total_chunks BIGINT,
  total_sources BIGINT,
  total_tags BIGINT,
  avg_chunk_length NUMERIC,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_chunks,
    COUNT(DISTINCT source) as total_sources,
    COUNT(DISTINCT unnest(tags)) as total_tags,
    AVG(LENGTH(chunk)) as avg_chunk_length,
    MIN(created_at) as oldest_entry,
    MAX(created_at) as newest_entry
  FROM coach_corpus;
END;
$$;

-- Function to search coach corpus with text query (automatically embeds the query)
CREATE OR REPLACE FUNCTION search_coach_corpus_by_text(
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5,
  source_filter TEXT DEFAULT NULL,
  tag_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  chunk TEXT,
  tags TEXT[],
  source TEXT,
  speaker TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Note: This function signature assumes we'll call it from application code
  -- that has already generated the embedding. In practice, we'll generate 
  -- embeddings in the application layer and use match_coach_corpus directly.
  RAISE EXCEPTION 'This function should be called from application code with pre-generated embeddings';
END;
$$; 