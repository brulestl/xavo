# 🚀 RAG Pipeline Deployment Instructions

## Overview
This guide will help you deploy the complete RAG (Retrieval-Augmented Generation) pipeline for the corporate-politics chat app. The system includes document upload, text extraction, vector embeddings, and intelligent document querying.

## Prerequisites
- Supabase project with PostgreSQL and pgvector extension
- OpenAI API key with access to embeddings and chat completion APIs
- Supabase CLI installed (`npm install -g supabase`)

---

## Step 1: Database Setup

### 1.1 Run Database Migration
Execute the RAG schema migration in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of sql/create_rag_schema.sql
-- This creates the documents and document_chunks tables with vector support
```

### 1.2 Create Storage Bucket
1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `documents`
3. Set the bucket to **private** (not public)
4. Configure the following policies:

```sql
-- Allow authenticated users to upload documents
INSERT INTO storage.policies (bucket_id, name, operation, definition, check)
VALUES (
  'documents',
  'Users can upload their own documents',
  'INSERT',
  'auth.uid()::text = (storage.foldername(name))[1]',
  'auth.uid()::text = (storage.foldername(name))[1]'
);

-- Allow users to read their own documents
INSERT INTO storage.policies (bucket_id, name, operation, definition, check)
VALUES (
  'documents',
  'Users can view their own documents',
  'SELECT',
  'auth.uid()::text = (storage.foldername(name))[1]',
  NULL
);

-- Allow users to delete their own documents
INSERT INTO storage.policies (bucket_id, name, operation, definition, check)
VALUES (
  'documents',
  'Users can delete their own documents',
  'DELETE',
  'auth.uid()::text = (storage.foldername(name))[1]',
  NULL
);
```

---

## Step 2: Deploy Edge Functions

### 2.1 Manual Deployment (Recommended)
Since you mentioned Docker issues, deploy via Supabase Dashboard:

1. **Go to Edge Functions**: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt/functions

2. **Deploy process-document function**:
   - Click "Create a new function"
   - Name: `process-document`
   - Copy the entire content from `supabase/functions/process-document/index.ts`
   - Click "Deploy function"

3. **Deploy query-document function**:
   - Click "Create a new function"
   - Name: `query-document`
   - Copy the entire content from `supabase/functions/query-document/index.ts`
   - Click "Deploy function"

### 2.2 Set Environment Variables
In Supabase Dashboard → Project Settings → Edge Functions, add:

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `SUPABASE_URL`: Auto-set by Supabase
- `SUPABASE_ANON_KEY`: Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Found in Project Settings → API

### 2.3 Test Edge Functions
After deployment, test the functions:

```bash
# Test process-document endpoint
curl -X POST 'https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/process-document' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"documentId": "test-id"}'

# Test query-document endpoint
curl -X POST 'https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/query-document' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"question": "What is this document about?"}'
```

---

## Step 3: Frontend Integration

### 3.1 Environment Variables
Ensure your `.env` or app config has:

```env
EXPO_PUBLIC_SUPABASE_URL=https://wdhmlynmbrhunizbdhdt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3.2 Install Required Packages
If not already installed:

```bash
npm install @supabase/supabase-js expo-document-picker expo-image-picker
```

### 3.3 Update App Configuration
In `app.json`, ensure these permissions exist:

```json
{
  "expo": {
    "plugins": [
      "expo-document-picker",
      "expo-image-picker"
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Needed to capture documents",
        "NSPhotoLibraryUsageDescription": "Needed to select document images"
      }
    },
    "android": {
      "permissions": [
        "READ_EXTERNAL_STORAGE",
        "CAMERA"
      ]
    }
  }
}
```

---

## Step 4: Testing the RAG Pipeline

### 4.1 Test Document Upload
1. Open your app
2. Start a new conversation
3. Tap the attach button (now positioned on the left)
4. Upload a PDF or text document
5. Verify the document shows "processing" → "completed" status

### 4.2 Test Document Queries
1. After a document is processed
2. Ask questions like:
   - "What is this document about?"
   - "Summarize the key points"
   - "What does it say about [specific topic]?"
3. Verify responses include document sources

### 4.3 Check Database
Verify data in Supabase:

```sql
-- Check uploaded documents
SELECT * FROM documents ORDER BY uploaded_at DESC LIMIT 5;

-- Check document chunks
SELECT d.filename, COUNT(c.id) as chunks 
FROM documents d 
LEFT JOIN document_chunks c ON d.id = c.document_id 
GROUP BY d.id, d.filename;

-- Test vector search
SELECT id, content, similarity 
FROM match_document_chunks(
  '[0.1, 0.2, ...]', -- Sample embedding vector
  'user-id-here',
  null,
  0.7,
  5
);
```

---

## Step 5: Monitoring & Troubleshooting

### 5.1 Edge Function Logs
Monitor function execution:
- Go to Supabase Dashboard → Edge Functions
- Click on function name → Logs tab
- Check for errors or processing times

### 5.2 Common Issues

**PDF Processing Fails**:
- Check file size (max 10MB)
- Verify PDF is text-based (not scanned images)
- Check OpenAI API quota

**Embeddings Not Generated**:
- Verify OpenAI API key in function environment
- Check OpenAI usage limits
- Monitor function timeout (max 60 seconds)

**Vector Search Returns No Results**:
- Verify embeddings were created (check `document_chunks` table)
- Lower similarity threshold (default 0.7)
- Check if documents are marked as "completed"

### 5.3 Performance Optimization
- Monitor token usage in OpenAI dashboard
- Adjust chunk size in `process-document` function if needed
- Consider batch processing for large documents

---

## Step 6: Production Considerations

### 6.1 Security
- ✅ Documents stored in private bucket with RLS
- ✅ Edge Functions secured with JWT authentication
- ✅ User data isolation via user_id filtering

### 6.2 Scalability
- Edge Functions auto-scale with traffic
- pgvector handles millions of embeddings efficiently
- Consider connection pooling for high traffic

### 6.3 Cost Management
- Monitor OpenAI API usage (embeddings + chat completion)
- Set up usage alerts in OpenAI dashboard
- Consider caching frequently accessed embeddings

---

## ✅ Success Indicators

After successful deployment, users should be able to:

1. **Upload Documents**: PDF, Word, and text files
2. **See Processing Status**: Real-time progress from upload → processing → completed
3. **Ask Questions**: Natural language queries about document content
4. **View Sources**: See which document sections were used for answers
5. **Attach Dialog Position**: Menu appears on the left side above attach button

## 🆘 Support

If you encounter issues:
1. Check Edge Function logs in Supabase Dashboard
2. Verify database migration completed successfully
3. Test with simple text files before complex PDFs
4. Monitor OpenAI API usage and quotas

## 📚 API Endpoints

After deployment, these endpoints will be available:

- **Process Document**: `POST /functions/v1/process-document`
- **Query Document**: `POST /functions/v1/query-document`
- **Chat (existing)**: `POST /functions/v1/chat`

The RAG pipeline is now ready for production use! 🎉 