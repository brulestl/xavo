# 🚀 Enhanced Memory System Deployment Guide

## 📋 Prerequisites
- Access to your Supabase database
- Environment variables properly configured
- API service with the enhanced code deployed

## 🗄️ Database Schema Updates

### Step 1: Apply Schema Changes
Run the enhanced schema script to add the new columns and tables:

```bash
# Option 1: Using Supabase CLI
supabase db reset

# Option 2: Using psql directly
psql postgresql://your-connection-string -f api/database/apply-enhanced-schema.sql

# Option 3: Run in Supabase SQL Editor
# Copy and paste the contents of api/database/apply-enhanced-schema.sql
```

### Step 2: Verify Schema
```sql
-- Check if new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversation_messages' 
  AND column_name IN ('raw_response', 'message_timestamp');

-- Check short_term_contexts table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'short_term_contexts';
```

## 🔧 Environment Configuration

### Required Environment Variables
```env
# Essential for the enhanced memory system
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # NOT anon key!
OPENAI_API_KEY=your_openai_api_key

# Optional: For debugging
NODE_ENV=development  # Enables detailed logging
```

## 🧪 Testing the Deployment

### Step 1: Basic Connectivity Test
```bash
cd api
node test-memory-system-simple.js
```

Expected output:
```
✅ Session creation: Working
✅ Message persistence: Working  
✅ Short-term context storage: Working
✅ Context retrieval: Working
✅ Context formatting: Working
```

### Step 2: Enhanced Features Test (After Schema Update)
```bash
node test-enhanced-memory-system.js
```

Expected output:
```
✅ conversation_messages with raw_response column
✅ short_term_contexts with context_embedding column
✅ Messages stored with raw responses
✅ Summaries generated with embeddings
```

## 🔍 Verification Checklist

### ✅ Database Schema
- [ ] `conversation_messages.raw_response` column exists
- [ ] `conversation_messages.message_timestamp` column exists  
- [ ] `short_term_contexts` table exists
- [ ] `short_term_contexts.context_embedding` column exists
- [ ] All indexes are created
- [ ] RLS policies are active

### ✅ Service Functionality
- [ ] Messages persist with timestamps
- [ ] Raw responses are stored
- [ ] Summaries generate with embeddings
- [ ] Context injection includes message history
- [ ] Background summary generation works

### ✅ API Endpoints
- [ ] `POST /api/v1/chat` works with context injection
- [ ] `GET /api/v1/chat/sessions/:id` returns full history
- [ ] Console logs show: `📊 Context retrieved: X tokens, Y messages`
- [ ] Database shows new entries in both tables

## 🚨 Troubleshooting

### Schema Issues
```sql
-- If raw_response column is missing:
ALTER TABLE conversation_messages ADD COLUMN raw_response JSONB;

-- If message_timestamp is missing:
ALTER TABLE conversation_messages ADD COLUMN message_timestamp TIMESTAMPTZ DEFAULT NOW();

-- If short_term_contexts table is missing:
-- Run the full schema creation from apply-enhanced-schema.sql
```

### Permission Issues
```bash
# Ensure you're using SERVICE_ROLE_KEY, not ANON_KEY
# Check in your .env file:
echo $SUPABASE_SERVICE_ROLE_KEY

# Test with a simple query:
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     "https://your-project.supabase.co/rest/v1/conversation_sessions?select=*&limit=1"
```

### OpenAI API Issues
```bash
# Test OpenAI connectivity:
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"text-embedding-3-small","input":"test"}' \
     https://api.openai.com/v1/embeddings
```

## 📊 Monitoring

### Key Metrics to Monitor
```sql
-- Message storage rate
SELECT DATE(created_at), COUNT(*) 
FROM conversation_messages 
GROUP BY DATE(created_at) 
ORDER BY DATE(created_at) DESC;

-- Summary generation rate  
SELECT DATE(created_at), COUNT(*)
FROM short_term_contexts
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- Raw response storage coverage
SELECT 
  COUNT(*) as total_messages,
  COUNT(raw_response) as with_raw_response,
  ROUND(COUNT(raw_response) * 100.0 / COUNT(*), 2) as coverage_percent
FROM conversation_messages 
WHERE role = 'assistant';
```

### Health Check Endpoint
Add this to your API for monitoring:
```typescript
@Get('health/memory')
async checkMemorySystem() {
  const checks = {
    database: await this.testDatabaseConnection(),
    summarization: await this.testSummaryGeneration(), 
    embeddings: await this.testEmbeddingGeneration(),
    contextInjection: await this.testContextInjection()
  };
  
  return {
    status: Object.values(checks).every(Boolean) ? 'healthy' : 'degraded',
    checks
  };
}
```

## 🎯 Rollback Plan

If issues arise, you can safely rollback:

```sql
-- Remove new columns (data will be lost)
ALTER TABLE conversation_messages DROP COLUMN IF EXISTS raw_response;
ALTER TABLE conversation_messages DROP COLUMN IF EXISTS message_timestamp;

-- Remove short_term_contexts table (data will be lost)
DROP TABLE IF EXISTS short_term_contexts;
```

## 🎉 Success Criteria

**The deployment is successful when:**
- ✅ All tests pass
- ✅ API responses include context injection logs
- ✅ Database shows message and summary entries
- ✅ Raw responses are being stored
- ✅ Embeddings are being generated
- ✅ No error logs in API service
- ✅ Conversation continuity works across sessions

**Your enhanced memory system is now live! 🚀** 