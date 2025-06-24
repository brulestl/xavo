# 🚀 Clean Edge Function Code for Deployment

## ⚡ Process Document Function

**Function Name:** `process-document`

**Copy this EXACT code:**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface ProcessDocumentRequest {
  documentId: string
  bucketPath?: string
  filename?: string
}

interface ProcessDocumentResponse {
  success: boolean
  documentId: string
  chunksCreated: number
  processingTime: number
  error?: string
}

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const { getDocument } = await import('https://esm.sh/pdfjs-dist@3.11.174/build/pdf.min.js');
    const pdf = await getDocument({ data: buffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `\n\nPage ${i}:\n${pageText}`;
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

async function extractTextFromFile(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return await extractTextFromPDF(buffer);
  } 
  
  if (mimeType.startsWith('text/')) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
  
  if (mimeType.includes('word') || mimeType.includes('document')) {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  throw new Error(`Unsupported file type: ${mimeType}`);
}

function chunkText(text: string, maxTokens: number = 1000): Array<{ content: string, page: number, chunkIndex: number }> {
  const chunks: Array<{ content: string, page: number, chunkIndex: number }> = [];
  const pages = text.split(/Page \d+:/);
  let globalChunkIndex = 0;
  
  pages.forEach((pageContent, pageIndex) => {
    if (!pageContent.trim()) return;
    
    const charsPerToken = 4;
    const maxChars = maxTokens * charsPerToken;
    
    if (pageContent.length <= maxChars) {
      chunks.push({
        content: pageContent.trim(),
        page: pageIndex === 0 ? 1 : pageIndex,
        chunkIndex: globalChunkIndex++
      });
    } else {
      const sentences = pageContent.split(/[.!?]+/);
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChars && currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            page: pageIndex === 0 ? 1 : pageIndex,
            chunkIndex: globalChunkIndex++
          });
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? '. ' : '') + sentence;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          page: pageIndex === 0 ? 1 : pageIndex,
          chunkIndex: globalChunkIndex++
        });
      }
    }
  });
  
  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Authentication required')
    }

    const { documentId, bucketPath, filename } = await req.json() as ProcessDocumentRequest
    
    console.log(`📄 Processing document: ${documentId}`)

    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) {
      throw new Error('Document not found or access denied')
    }

    await supabaseClient.rpc('update_document_status', {
      doc_id: documentId,
      status: 'processing'
    })

    const filePath = bucketPath || document.bucket_path
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(filePath)

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    
    console.log(`📖 Extracting text from ${document.file_type}`)
    
    const extractedText = await extractTextFromFile(arrayBuffer, document.file_type)
    
    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error('No meaningful text content found in document')
    }

    console.log(`✂️ Chunking text (${extractedText.length} characters)`)
    
    const chunks = chunkText(extractedText)
    
    if (chunks.length === 0) {
      throw new Error('No text chunks created from document')
    }

    console.log(`🧮 Generating embeddings for ${chunks.length} chunks`)
    
    const batchSize = 5
    const chunkRecords = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      const embeddingPromises = batch.map(chunk => generateEmbedding(chunk.content))
      const embeddings = await Promise.all(embeddingPromises)
      
      const batchRecords = batch.map((chunk, index) => ({
        document_id: documentId,
        page: chunk.page,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        token_count: Math.ceil(chunk.content.length / 4),
        embedding: JSON.stringify(embeddings[index])
      }))
      
      chunkRecords.push(...batchRecords)
      
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`💾 Saving ${chunkRecords.length} chunks to database`)
    
    const insertBatchSize = 10
    for (let i = 0; i < chunkRecords.length; i += insertBatchSize) {
      const insertBatch = chunkRecords.slice(i, i + insertBatchSize)
      
      const { error: insertError } = await supabaseClient
        .from('document_chunks')
        .insert(insertBatch)
      
      if (insertError) {
        console.error('Chunk insert error:', insertError)
        throw new Error(`Failed to save chunks: ${insertError.message}`)
      }
    }

    await supabaseClient.rpc('update_document_status', {
      doc_id: documentId,
      status: 'completed',
      chunk_count_val: chunks.length
    })

    const processingTime = Date.now() - startTime

    console.log(`✅ Document processing completed in ${processingTime}ms`)

    const response: ProcessDocumentResponse = {
      success: true,
      documentId: documentId,
      chunksCreated: chunks.length,
      processingTime: processingTime
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Document processing error:', error)
    
    try {
      const { documentId } = await req.json() as ProcessDocumentRequest
      if (documentId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )
        
        await supabaseClient.rpc('update_document_status', {
          doc_id: documentId,
          status: 'failed',
          error_message: error.message
        })
      }
    } catch (updateError) {
      console.error('Failed to update document status:', updateError)
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
```

## ⚡ Query Document Function

**Function Name:** `query-document`

**Copy this EXACT code:**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface QueryDocumentRequest {
  question: string
  documentId?: string
  sessionId?: string
  includeConversationContext?: boolean
}

interface QueryDocumentResponse {
  id: string
  answer: string
  sources: Array<{
    documentId: string
    filename: string
    page: number
    chunkIndex: number
    similarity: number
    content: string
  }>
  timestamp: string
  sessionId?: string
  tokensUsed: number
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Authentication required')
    }

    const { question, documentId, sessionId, includeConversationContext } = await req.json() as QueryDocumentRequest
    
    if (!question?.trim()) {
      throw new Error('Question is required')
    }

    console.log(`🔍 Querying documents for user ${user.id}:`, question.substring(0, 100))

    const questionEmbedding = await generateEmbedding(question)

    const { data: matchingChunks, error: searchError } = await supabaseClient
      .rpc('match_document_chunks', {
        query_embedding: JSON.stringify(questionEmbedding),
        filter_user_id: user.id,
        filter_document_id: documentId || null,
        similarity_threshold: 0.7,
        match_count: 5
      })

    if (searchError) {
      console.error('Vector search error:', searchError)
      throw new Error(`Document search failed: ${searchError.message}`)
    }

    if (!matchingChunks || matchingChunks.length === 0) {
      const noResultsResponse: QueryDocumentResponse = {
        id: `query-${Date.now()}`,
        answer: "I couldn't find relevant information in your uploaded documents to answer this question. Please try rephrasing your question or ensure your documents contain information related to your query.",
        sources: [],
        timestamp: new Date().toISOString(),
        sessionId: sessionId,
        tokensUsed: 0
      }

      return new Response(JSON.stringify(noResultsResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`📄 Found ${matchingChunks.length} relevant chunks`)

    const documentContext = matchingChunks
      .map((chunk, index) => 
        `[Source ${index + 1} - ${chunk.document_filename}, Page ${chunk.page}]:\n${chunk.content}`
      )
      .join('\n\n---\n\n')

    let conversationContext = ''
    if (includeConversationContext && sessionId) {
      const { data: recentMessages } = await supabaseClient
        .from('conversation_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6)

      if (recentMessages && recentMessages.length > 0) {
        conversationContext = '\n\nPrevious conversation context:\n' + 
          recentMessages
            .reverse()
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n')
      }
    }

    const systemPrompt = `You are an AI assistant specialized in analyzing and answering questions about documents. Your task is to provide accurate, helpful answers based on the provided document context.

Guidelines:
- Answer the question based ONLY on the information provided in the document sources
- If the documents don't contain enough information to answer the question, clearly state this
- Always cite which source(s) you're referencing in your answer
- Be precise and avoid speculation
- If multiple sources provide different perspectives, acknowledge this
- Keep your answer focused and relevant to the question

Document context:
${documentContext}${conversationContext}`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Question: ${question}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const aiResult = await openaiResponse.json()
    const aiAnswer = aiResult.choices[0].message.content

    if (sessionId) {
      const userClientId = crypto.randomUUID()
      await supabaseClient
        .from('conversation_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'user',
          content: question,
          action_type: 'document_query',
          metadata: { 
            query_type: 'document',
            document_id: documentId,
            sources_found: matchingChunks.length
          },
          created_at: new Date().toISOString(),
          message_timestamp: new Date().toISOString(),
          client_id: userClientId
        })

      const assistantClientId = crypto.randomUUID()
      await supabaseClient
        .from('conversation_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'assistant',
          content: aiAnswer,
          action_type: 'document_response',
          metadata: { 
            query_type: 'document',
            document_id: documentId,
            sources_used: matchingChunks.map(chunk => ({
              document_id: chunk.document_id,
              filename: chunk.document_filename,
              page: chunk.page,
              similarity: chunk.similarity
            }))
          },
          raw_response: aiResult,
          created_at: new Date().toISOString(),
          message_timestamp: new Date().toISOString(),
          client_id: assistantClientId
        })

      await supabaseClient
        .from('conversation_sessions')
        .update({
          last_message_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    }

    const response: QueryDocumentResponse = {
      id: `query-${Date.now()}`,
      answer: aiAnswer,
      sources: matchingChunks.map(chunk => ({
        documentId: chunk.document_id,
        filename: chunk.document_filename,
        page: chunk.page,
        chunkIndex: chunk.chunk_index,
        similarity: Math.round(chunk.similarity * 100) / 100,
        content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : '')
      })),
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      tokensUsed: aiResult.usage?.total_tokens || 0
    }

    console.log(`✅ Document query completed with ${response.sources.length} sources`)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Document query error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
```

## 🚀 Deployment Steps

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt/functions

2. **Create process-document function**:
   - Click "Create a new function"
   - Name: `process-document`
   - Copy the FIRST code block above (process-document)
   - Make sure NO extra content is included
   - Deploy

3. **Create query-document function**:
   - Click "Create a new function"
   - Name: `query-document`
   - Copy the SECOND code block above (query-document)
   - Deploy

4. **Set environment variable**:
   - Go to Project Settings → Edge Functions
   - Add: `OPENAI_API_KEY` = your OpenAI API key

## ⚠️ Important Notes

- Copy ONLY the TypeScript code inside the ```typescript``` blocks
- Do NOT include any markdown headers or comments
- Make sure there are no hidden characters or formatting issues
- Each function should start with `import { serve }` and end with the closing `})`

The error you encountered was due to mixed content in the function code. These clean versions should deploy without issues! 