# RAG Endpoints Testing Guide

This guide provides comprehensive testing for the RAG (Retrieval-Augmented Generation) endpoints: `process-document` and `query-document`.

## Prerequisites

### 1. Environment Setup

Create a `.env` file with the following variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Test User Credentials
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword123

# OpenAI Configuration (for edge functions)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Database Setup

Ensure you have run the RAG database migration:

```sql
-- Run sql/create_rag_schema.sql in your Supabase SQL editor
```

### 3. Storage Setup

Create the `documents` storage bucket in Supabase:
1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `documents`
3. Set it to private (RLS will handle access control)

### 4. Edge Functions Deployment

Deploy both edge functions:

```bash
# Deploy process-document function
supabase functions deploy process-document

# Deploy query-document function  
supabase functions deploy query-document

# Set environment variables for edge functions
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 5. Test User Account

Create a test user account in your app or via Supabase Auth.

## Testing Options

### Option 1: Comprehensive Test Suite

Run the full test suite that tests both endpoints:

```bash
node test-rag-endpoints.js
```

This will:
- Check environment variables
- Test endpoint availability
- Run process-document tests
- Run query-document tests
- Provide a summary

### Option 2: Individual Endpoint Tests

#### Test process-document endpoint only:
```bash
node test-process-document.js
# OR
node test-rag-endpoints.js --process-only
```

#### Test query-document endpoint only:
```bash
node test-query-document.js
# OR
node test-rag-endpoints.js --query-only
```

#### Test endpoint health only:
```bash
node test-rag-endpoints.js --health-only
```

### Option 3: Help and Usage

```bash
node test-rag-endpoints.js --help
```

## What Each Test Does

### Process Document Test

1. **Authentication**: Signs in with test credentials
2. **File Creation**: Creates a test document with corporate influence content
3. **File Upload**: Uploads the document to Supabase storage
4. **Database Record**: Creates a document record in the database
5. **Processing**: Calls the process-document endpoint to:
   - Extract text from the document
   - Chunk the text into manageable pieces
   - Generate embeddings using OpenAI
   - Store chunks and embeddings in the database
6. **Verification**: Confirms chunks are properly stored
7. **Cleanup**: Removes test files (optional database cleanup)

Expected output:
```
✅ Document processed successfully!
   Chunks created: 3
   Processing time: 2547ms
✅ Found 3 chunks in database
   Status: completed
```

### Query Document Test

1. **Authentication**: Signs in with test credentials
2. **Document Discovery**: Finds available processed documents
3. **Session Creation**: Creates a conversation session
4. **Question Testing**: Tests various types of questions:
   - Key findings extraction
   - Specific data queries
   - Conclusion summarization
   - Methodology questions
   - Comparative analysis
5. **Global Search**: Tests searching across all documents
6. **Irrelevant Query**: Tests handling of off-topic questions
7. **History Verification**: Confirms conversation storage

Expected output:
```
📝 Test 1: Testing extraction of key findings
   Question: "What are the key findings mentioned in the document?"
   ✅ Query successful!
   📊 Response time: 1234ms
   🔍 Sources found: 2
   🎯 Tokens used: 156
   
   📄 Answer:
   Based on the document, the key findings are:
   1. Hierarchical structures significantly impact information flow
   2. Informal networks often bypass official channels  
   3. Decision authority varies by organizational culture
```

## Expected Test Results

### Successful Process Document Test:
- Authentication successful
- Test file created and uploaded
- Document record created in database
- Text extraction and chunking completed
- Embeddings generated and stored
- Document status marked as "completed"
- Cleanup completed

### Successful Query Document Test:
- Authentication successful
- Processed documents found
- Conversation session created
- All test questions answered with relevant sources
- Global document search works
- Irrelevant questions handled gracefully
- Conversation history stored properly

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Failed
```
❌ Authentication failed: Invalid login credentials
```
**Solution**: Verify TEST_EMAIL and TEST_PASSWORD are correct and the user exists.

#### 2. Endpoint Not Accessible
```
❌ Query-document endpoint is not accessible
```
**Solution**: Ensure edge functions are deployed and running.

#### 3. File Upload Failed
```
❌ File upload failed: The resource was not found
```
**Solution**: Create the `documents` storage bucket in Supabase.

#### 4. OpenAI API Error
```
❌ OpenAI embedding failed: Unauthorized
```
**Solution**: Set the OPENAI_API_KEY environment variable for edge functions.

#### 5. Database Schema Error
```
❌ relation "documents" does not exist
```
**Solution**: Run the SQL migration file to create the RAG schema.

#### 6. No Processed Documents
```
⚠️ No processed documents found. Please run test-process-document.js first.
```
**Solution**: Run the process-document test first to create test documents.

### Debug Mode

For more detailed debugging, you can:

1. Check Supabase function logs:
   ```bash
   supabase functions logs process-document
   supabase functions logs query-document
   ```

2. Check the database directly:
   ```sql
   SELECT * FROM documents WHERE user_id = 'your-user-id';
   SELECT * FROM document_chunks WHERE document_id = 'your-document-id';
   ```

3. Monitor real-time logs during testing:
   ```bash
   supabase functions logs --follow
   ```

## Performance Benchmarks

### Typical Performance Metrics:

- **Document Processing**: 2-5 seconds for a 1-page text document
- **Query Response**: 1-3 seconds per question
- **Embedding Generation**: ~100ms per chunk
- **Vector Search**: <500ms

### Large Document Expectations:

- **10-page PDF**: 5-10 seconds processing
- **50-page PDF**: 15-30 seconds processing
- **Complex queries**: 2-5 seconds response time

## Test Data

The test scripts use a sample "Corporate Influence Analysis Report" with:
- Introduction section
- Key findings (3 main points)
- Methodology description
- Results section
- Conclusion

This provides good coverage for testing various query types and RAG functionality.

## Next Steps

After successful testing:

1. **Production Deployment**: Deploy to your production environment
2. **Monitoring Setup**: Implement logging and monitoring
3. **User Testing**: Test with real user accounts and documents
4. **Performance Optimization**: Monitor and optimize based on usage patterns
5. **Error Handling**: Implement comprehensive error handling in your app

## Security Notes

- Test credentials should only be used in development
- Ensure RLS policies are properly configured
- Monitor OpenAI API usage to avoid unexpected costs
- Regularly rotate API keys and test credentials 