-- ========================================
-- VECTOR RAG SETUP - NO INDEX INITIALLY
-- ========================================
-- This version skips index creation to avoid memory limits
-- Index will be added later when you have actual embeddings

-- Step 1: Enable vector extension for pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to document_chunks table
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: SKIP INDEX CREATION FOR NOW
-- (We'll add this later when there are actual embeddings)

-- Step 4: Drop existing function if it exists
DROP FUNCTION IF EXISTS match_document_chunks(vector, uuid, integer);
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), uuid, int);

-- Step 5: Create the match_document_chunks function for similarity search
CREATE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  p_document_id  uuid,
  match_count    int
) RETURNS TABLE (
  id                uuid,
  document_id       uuid,
  content           text,
  similarity        float,
  document_filename text,
  page              int,
  chunk_index       int
) AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.filename AS document_filename,
    dc.page,
    dc.chunk_index
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.document_id = p_document_id
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- Step 6: Grant permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1536), uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1536), uuid, int) TO service_role;

-- ========================================
-- ADD INDEX LATER (RUN THIS AFTER UPLOADING DOCUMENTS)
-- ========================================
-- Once you have uploaded some documents and have embeddings in the table,
-- run this command to add the index:

/*
CREATE INDEX document_chunks_embedding_idx
  ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1);
*/

-- ========================================
-- WHY THIS APPROACH WORKS
-- ========================================
-- 1. Index creation needs memory even on empty tables
-- 2. Queries will work fine without index (just slower on large datasets)
-- 3. You can add the index later when you have actual data
-- 4. Start with lists=1, then upgrade as your dataset grows 