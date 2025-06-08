# RAG Implementation - Corporate Influence Coach API

## 🧠 **RAG System Overview**

This implementation adds **Retrieval Augmented Generation (RAG)** to the Corporate Influence Coach, providing long-term memory and personalized context for each user. The system uses Supabase Vector (pgvector) for efficient similarity search and maintains conversation history with embeddings.

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   User Query    │───▶│   RAG Service    │───▶│   Enhanced Prompt   │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │                          │
                         ┌──────▼──────┐                   ▼
                         │   Memory    │          ┌─────────────────┐
                         │   Service   │          │   AI Model      │
                         └──────┬──────┘          │   Router        │
                                │                 └─────────────────┘
                    ┌───────────▼───────────┐
                    │  Supabase Vector DB   │
                    │  • Conversations      │
                    │  • Embeddings         │
                    │  • User Profiles      │
                    └───────────────────────┘
```

## 🔧 **Components**

### 1. **Embeddings Module**
- **Unified Interface**: Works with OpenAI, Cohere, HuggingFace
- **Configurable Providers**: Easy to switch between embedding models
- **Batch Processing**: Efficient bulk embedding generation
- **Dimension Validation**: Ensures embedding compatibility

### 2. **Memory Module**
- **Conversation Storage**: Stores all user interactions with embeddings
- **Session Management**: Groups conversations by sessions
- **User Profiles**: Maintains user preferences and context
- **Similarity Search**: Finds relevant historical conversations

### 3. **RAG Module**
- **Context Enhancement**: Combines recent + historical + profile context
- **Smart Prompting**: Builds enhanced prompts with relevant context
- **Token Management**: Respects model token limits
- **Relevance Scoring**: Prioritizes most relevant context

## 📊 **Database Schema**

### Tables Created:
1. **`conversation_sessions`** - Chat session metadata
2. **`conversation_messages`** - Individual messages with embeddings
3. **`user_profiles`** - User personalization data

### Key Features:
- **Vector Embeddings**: 1536-dimension vectors (OpenAI text-embedding-3-small)
- **HNSW Indexing**: Fast similarity search
- **Row Level Security**: User data isolation
- **Automatic Triggers**: Session activity updates

## 🚀 **Setup Instructions**

### 1. **Supabase Database Setup**

Run the schema in your Supabase dashboard:

```sql
-- Execute the SQL in database/supabase-schema.sql
-- This creates tables, indexes, RLS policies, and functions
```

**Enable pgvector extension:**
1. Go to Supabase Dashboard → Database → Extensions
2. Enable `vector` extension

### 2. **Environment Variables**

Add to your `.env` file:

```env
# Existing variables...
OPENAI_API_KEY=your_openai_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
EMBEDDING_PROVIDER=openai
```

### 3. **Verify Installation**

Build and test:
```bash
npm run build
npm run start:dev
```

Check logs for successful module initialization.

## 💡 **How RAG Works**

### 1. **User Sends Message**
```
User: "How should I approach my manager about a promotion?"
```

### 2. **RAG Enhancement**
The system:
1. **Generates embedding** for the current query
2. **Searches similar past conversations** using vector similarity
3. **Retrieves recent session context** (last 10 messages)
4. **Loads user profile** (role, industry, communication style)
5. **Builds enhanced prompt** with all context

### 3. **Enhanced Prompt Example**
```
You are a Corporate Influence Coach...

User Context:
- Role: Software Engineer
- Industry: Technology
- Communication Style: diplomatic, detailed

Recent Conversation:
User: "I've been working on a high-impact project..."
Assistant: "That's excellent positioning for advancement..."

Relevant Past Discussions:
- Previous promotion strategy discussion from 2 weeks ago
- Stakeholder mapping exercise for similar situation

Current Question: How should I approach my manager about a promotion?

Please provide a comprehensive response that takes into account 
the conversation history and user context above.
```

### 4. **Contextual Response**
The AI model now has:
- **Personal context** (user's role, style)
- **Conversation history** (what was discussed before)
- **Similar situations** (relevant past conversations)
- **Current question** (immediate query)

Result: **Highly personalized, contextually aware responses**

## 🎯 **Tier-Based Features**

### **Essential Tier**
- Recent conversation context (10 messages)
- Basic user profile
- No historical context search

### **Power Strategist Tier**
- Recent conversation context (10 messages)
- Full user profile with preferences
- **Historical context search** (5 most relevant past conversations)
- **4000 token context limit** vs 2000 for Essential

## 📈 **RAG Context Sources**

The system tracks context sources for transparency:

```json
{
  "contextSources": [
    "5 recent messages",
    "3 relevant past discussions", 
    "user profile"
  ],
  "relevanceScore": 0.85
}
```

## 🔍 **Similarity Search**

Uses **cosine similarity** with configurable thresholds:

- **Similarity threshold**: 0.7 (70% similarity required)
- **Time decay**: Recent conversations weighted higher
- **Session exclusion**: Avoids current session duplicates
- **User isolation**: Only searches user's own conversations

## 🛡️ **Privacy & Security**

- **Row Level Security**: Users only access their own data
- **Embedding isolation**: Vector search respects user boundaries
- **Data retention**: Configurable conversation cleanup
- **Service role key**: Secure database access for embeddings

## 📊 **Performance Optimizations**

1. **HNSW Vector Index**: Fast approximate similarity search
2. **Batch Embedding**: Process multiple texts efficiently
3. **Token Estimation**: Prevents context overflow
4. **Async Operations**: Non-blocking embedding generation
5. **Error Handling**: Graceful degradation if RAG fails

## 🔧 **Configuration Options**

```typescript
const ragOptions = {
  useRecentContext: true,        // Include recent messages
  useHistoricalContext: true,    // Include similar past conversations
  useUserProfile: true,          // Include user preferences
  maxContextTokens: 4000,        // Token limit for context
  memoryOptions: {
    maxRecentMessages: 10,       // Number of recent messages
    maxRelevantHistory: 5,       // Number of historical matches
    similarityThreshold: 0.7,    // Minimum similarity score
  }
};
```

## 🧪 **Testing RAG**

### Test with cURL:
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "I need advice on stakeholder management",
    "actionType": "plan_strategy",
    "sessionId": "test-session-123"
  }'
```

### Expected Enhancements:
1. **First message**: Basic response
2. **Follow-up messages**: Include recent context
3. **Similar topics**: Reference past relevant discussions
4. **Power tier users**: Get richer historical context

## 🔄 **Next Steps**

### Phase 1: Basic RAG ✅
- [x] Embeddings service with unified interface
- [x] Memory storage and retrieval
- [x] Vector similarity search
- [x] Context-enhanced prompts

### Phase 2: Advanced Features
- [ ] **Conversation summarization** for long sessions
- [ ] **Topic clustering** for better context grouping
- [ ] **User preference learning** from interaction patterns
- [ ] **Multi-modal embeddings** for document uploads

### Phase 3: Intelligence Features
- [ ] **Automatic user profiling** from conversation patterns
- [ ] **Proactive suggestions** based on similar user journeys
- [ ] **Context compression** for very long conversations
- [ ] **Semantic routing** for specialized model selection

## 📝 **Usage Examples**

### Scenario: Promotion Discussion

**Message 1:**
```
User: "I'm thinking about asking for a promotion"
Response: Basic promotion advice
```

**Message 2 (same session):**
```
User: "What timing would be best?"
Context: Includes previous promotion discussion
Response: Specific timing advice considering previous context
```

**Message 3 (new session, 1 week later):**
```
User: "How should I prepare for the promotion conversation?"
Context: Includes previous promotion discussions + user profile
Response: Comprehensive preparation advice based on past context
```

## 🎯 **Success Metrics**

- **Context Relevance**: Average similarity scores
- **User Engagement**: Session length and depth
- **Response Quality**: User feedback on contextual responses
- **Memory Efficiency**: Embedding storage and retrieval performance

The RAG system transforms the Corporate Influence Coach from a stateless chatbot into an intelligent, memory-enabled coach that learns and adapts to each user's unique context and needs. 