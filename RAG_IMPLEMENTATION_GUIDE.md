# RAG Pipeline Implementation Guide

This guide covers the complete implementation of the Retrieval-Augmented Generation (RAG) pipeline for Xavo's Corporate Influence Coach, integrating 500+ hours of coaching transcripts with dynamic personalization.

## 🎯 Overview

The RAG pipeline enhances Xavo's responses by:
- **Coach Corpus Integration**: 500+ hours of transcript data searchable via pgvector
- **Dynamic Personalization**: User tier, position, and challenge-specific responses  
- **System Prompt Automation**: Rich "Coach" prompt with real-time context injection
- **Semantic Search**: Vector similarity matching for relevant expertise retrieval
- **Multi-tier Context**: Different context windows based on user subscription tier

## 🏗️ Architecture

```
User Query → RAG Service → [Coach Corpus Search + Memory Context] → Enhanced Prompt → OpenAI → Response
```

**Components:**
1. **Coach Corpus Table** (`coach_corpus`) - Vector database with transcript embeddings
2. **Enhanced RAG Service** - Orchestrates retrieval and context building
3. **Coach Prompt System** - Dynamic prompt generation with personalization
4. **Vector Search Functions** - PostgreSQL functions for similarity search
5. **Ingestion Pipeline** - Processes JSONL training data into embeddings

## 📊 Database Schema

### Coach Corpus Table
```sql
CREATE TABLE coach_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk TEXT NOT NULL,
  embedding VECTOR(1536),
  tags TEXT[],
  source TEXT,
  speaker TEXT,
  original_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  token_count INTEGER
);

-- HNSW index for fast vector search
CREATE INDEX idx_coach_corpus_embedding 
ON coach_corpus USING hnsw (embedding vector_cosine_ops);
```

### Key Functions
- `match_coach_corpus()` - Vector similarity search
- `get_coach_corpus_stats()` - Corpus statistics

## 🚀 Setup Instructions

### 1. Enable pgvector Extension
In your Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Create Database Schema
```bash
# Apply the coach corpus schema
psql -f api/database/coach-corpus-schema.sql
```

### 3. Set Environment Variables
Ensure these are set in your `.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

### 4. Install Dependencies
```bash
cd api
npm install @supabase/supabase-js openai
```

## 📥 Data Ingestion

### Running the Ingestion Script
```bash
cd api
node scripts/ingest-coach-corpus.js
```

**What it does:**
- Reads all JSONL files from `llm_training_data/`
- Generates embeddings for each text chunk using OpenAI
- Stores chunks with embeddings in `coach_corpus` table
- Processes in batches of 50 for efficiency
- Tracks costs and statistics

**Expected Output:**
```
🚀 Starting Coach Corpus Ingestion
📁 Found 45 JSONL files to process
📦 Batch size: 50 chunks
🤖 Embedding model: text-embedding-3-small

[1/45] Processing final_cleaned_the_leadership_pod_processed.jsonl
  Generating embedding for chunk 1...
  📦 Inserting batch of 50 chunks...
✅ Completed final_cleaned_the_leadership_pod_processed.jsonl: 21 chunks processed

🎉 INGESTION COMPLETE
📄 Total chunks found: 15,847
✅ Successfully processed: 15,847
💰 Estimated cost: $6.34
```

### Data Format
Training data should be in JSONL format:
```json
{
  "id": "uuid",
  "text": "coaching content...",
  "tags": ["leadership", "communication"],
  "source": "podcast_name",
  "speaker": "Expert Name",
  "original_metadata": {...}
}
```

## 🔧 Configuration

### User Personalization
The system adapts responses based on:
```typescript
interface UserPersonalization {
  current_position?: string;
  industry?: string;
  seniority_level?: 'junior' | 'mid-management' | 'senior' | 'c-suite';
  top_challenges?: string[];
  communication_style?: {
    formality?: 'casual' | 'balanced' | 'formal';
    directness?: 'diplomatic' | 'balanced' | 'direct';
  };
}
```

### Tier-based Limits
```typescript
// Context token limits by tier
trial: 2,000 tokens
strategist: 32,000 tokens  
shark: 128,000 tokens

// Coach corpus search results
trial/strategist: 3 chunks
shark: 5 chunks
```

## 🧪 Testing

### Run Test Suite
```bash
cd api
node scripts/test-rag-pipeline.js
```

**Test Coverage:**
- Database connectivity
- Embedding generation
- Vector search functionality
- Coach corpus statistics
- End-to-end RAG queries
- Corporate influence specific queries

### Manual Testing
```bash
# Test specific query
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-tier: shark" \
  -d '{"message": "How do I handle office politics effectively?"}'
```

## 📈 Performance Metrics

### Expected Performance
- **Embedding Generation**: ~100ms per chunk
- **Vector Search**: <200ms for similarity search  
- **End-to-end Response**: <2s for first token
- **Context Assembly**: <300ms
- **Total Pipeline**: <2.5s response time

### Monitoring
```typescript
// Available in RAG service
const stats = await ragService.getCoachCorpusStats();
console.log({
  totalChunks: stats.total_chunks,
  totalSources: stats.total_sources,
  avgChunkLength: stats.avg_chunk_length
});
```

## 🎯 Usage Examples

### Basic RAG Query
```typescript
const ragContext = await ragService.enhanceRequestWithRAG(
  { message: "How do I build executive presence?", sessionId: "123" },
  { id: "user123", tier: "shark" },
  {
    useCoachCorpus: true,
    maxContextTokens: 8000,
    coachCorpusThreshold: 0.75,
    coachCorpusCount: 3
  }
);
```

### Coach Prompt with Personalization
```typescript
const prompt = buildCoachPrompt({
  tier: 'shark',
  userPersonalization: {
    current_position: 'Senior Manager',
    industry: 'Technology',
    seniority_level: 'senior',
    top_challenges: ['team leadership', 'stakeholder management']
  }
});
```

### Complete Chat Flow
```typescript
// 1. Get enhanced context
const ragContext = await ragService.enhanceRequestWithRAG(request, user, options);

// 2. Build messages with personalization
const messages = buildChatMessages(userMessage, {
  context: ragContext.enhancedPrompt,
  tier: user.tier,
  userPersonalization: userProfile
});

// 3. Stream response
const completion = await streamCoachAssistant(messages);
```

## 🔍 Troubleshooting

### Common Issues

**1. "No embeddings found"**
- Run the ingestion script: `node scripts/ingest-coach-corpus.js`
- Check that JSONL files exist in `llm_training_data/`

**2. "Vector search returns no results"**
- Lower the similarity threshold (default 0.75 → 0.6)
- Check embedding model consistency
- Verify pgvector extension is enabled

**3. "RAG context too large"**
- Reduce `maxContextTokens` in RAG options
- Decrease `coachCorpusCount` parameter

**4. "Coach prompt template not found"**
- Ensure `prompts/coach.txt` exists in project root
- Check file permissions and path resolution

### Debug Mode
```typescript
// Enable detailed logging
const ragContext = await ragService.enhanceRequestWithRAG(request, user, {
  ...options,
  debug: true  // Add this for verbose logging
});
```

### Performance Issues
```sql
-- Check index usage
EXPLAIN ANALYZE 
SELECT * FROM coach_corpus 
ORDER BY embedding <=> '[0,1,2...]' 
LIMIT 5;

-- Rebuild index if needed
REINDEX INDEX idx_coach_corpus_embedding;
```

## 📊 Cost Estimation

### OpenAI Costs
```
Embedding Generation (one-time):
- ~50K chunks × 500 tokens avg = 25M tokens
- Cost: 25M tokens × $0.00002/1K = $500

Query Embeddings (ongoing):
- Per query: ~20 tokens × $0.00002/1K = $0.0004
- 1000 queries/day = $0.40/day
```

### Supabase Costs
- Storage: ~2GB for embeddings (included in most plans)
- Database requests: Standard pricing applies

## 🔧 Advanced Configuration

### Custom Vector Search
```sql
-- Search with source filtering
SELECT * FROM match_coach_corpus(
  query_embedding := $1,
  match_threshold := 0.8,
  match_count := 5,
  source_filter := 'leadership_podcast'
);
```

### Personalization Tuning
```typescript
// Adjust persona detection
export function extractUserPersona(userPersonalization: UserPersonalization): string {
  // Custom logic for persona classification
  const position = userPersonalization.current_position?.toLowerCase() || '';
  
  if (position.includes('founder') || position.includes('ceo')) {
    return 'C-suite / Founder';
  }
  // ... additional logic
}
```

## 🚀 Deployment

### Production Checklist
- [ ] pgvector extension enabled in production Supabase
- [ ] Coach corpus data ingested (~50K chunks expected)
- [ ] Environment variables configured
- [ ] Vector search indexes optimized
- [ ] RAG pipeline tested end-to-end
- [ ] Performance monitoring enabled
- [ ] Error handling implemented

### Scaling Considerations
- **Large Datasets**: Consider chunking strategy for very large corpora
- **High Traffic**: Implement response caching for common queries
- **Cost Control**: Monitor embedding API usage and set limits
- **Performance**: Consider read replicas for search-heavy workloads

---

## 📞 Support

For questions or issues:
1. Check the troubleshooting section above
2. Run the test suite: `node scripts/test-rag-pipeline.js`
3. Review logs for specific error messages
4. Verify environment variables and database connectivity

**Last Updated**: January 2025  
**Version**: 1.0  
**Dependencies**: Supabase pgvector, OpenAI embeddings API, Node.js 18+ 