import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Types
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
  userMessageId?: string
  assistantMessageId?: string
}

// Generate embedding for the question
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    // Primary client using ANON key (for auth & RPC)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Service-role client (bypasses RLS for fallback fetch)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT token
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

    // Fetch filename for prompt context
    const { data: docMeta } = await supabaseClient
      .from('documents')
      .select('filename')
      .eq('id', documentId)
      .single()

    const filename = docMeta?.filename ?? 'Document'

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question)
    
    // Detailed debug logging before RPC
    console.log('🔍 questionEmbedding slice:', questionEmbedding.slice(0,5), '… length:', questionEmbedding.length)
    console.log('🔍 calling RPC match_document_chunks with documentId:', documentId)

    // Plain TEXT → wrapper casts to vector
    const stringifiedEmbedding = `[${questionEmbedding.join(',')}]`;
    console.log(
      `🔧 Embedding text for wrapper: ${stringifiedEmbedding.substring(0, 50)}...`
    );

    // Call wrapper via service-role client (bypasses RLS)
    const { data: matchingChunks, error: rpcError } = await serviceClient.rpc(
      'match_document_chunks_rest',
      {
        p_query_embedding_text: stringifiedEmbedding,
        p_document_id:          documentId,
        match_count:            5
      }
    )

    // Detailed debug logging after RPC
    if (rpcError) console.error('❌ RPC error:', rpcError)
    console.log('🔍 matchingChunks count:', matchingChunks?.length || 0)
    console.dir(matchingChunks, { depth: 1 })

    if (rpcError) {
      console.error('❌ Vector search error:', rpcError)
      throw new Error(`Document search failed: ${rpcError.message}`)
    }

    // 🔥 CRITICAL FIX: Handle no chunks case but still create conversation messages
    let aiAnswer = '';
    let aiResult: any = { usage: { total_tokens: 0 } };
    let actualMatchingChunks = matchingChunks || [];

    if (!matchingChunks || matchingChunks.length === 0) {
      console.log('⚠️ No chunks found - using fallback response but continuing with conversation flow')
      
      // 🔧 Try debug function to see what's available
      try {
        const { data: debugChunks, error: debugError } = await supabaseClient.rpc('debug_document_chunks', {
          p_document_id: documentId,
          match_count: 5
        });
        
        if (!debugError && debugChunks?.length > 0) {
          console.log(`🔍 Debug function found ${debugChunks.length} chunks without embeddings`);
          console.log('First chunk preview:', debugChunks[0]?.content?.substring(0, 100));
        }
      } catch (debugErr) {
        console.log('Debug function not available:', debugErr);
      }

      // Generate a helpful fallback response
      aiAnswer = `I can see that you uploaded the document "${filename}", but I'm having trouble accessing its content for analysis. This could be because:

1. The document is still being processed
2. The document content couldn't be extracted properly
3. There's a temporary issue with the document analysis system

Could you please try:
- Re-uploading the document
- Asking a more general question about the document
- Checking if the document uploaded completely

I'd be happy to help once the document is properly processed!`;

      // Create minimal result object
      aiResult = {
        usage: { total_tokens: 50 },
        choices: [{ message: { content: aiAnswer } }]
      };
    } else {
      console.log(`📄 Found ${matchingChunks.length} relevant chunks`)

      // Build system prompt using chunks
      const docsContext = matchingChunks
        .map((c, i) => `[Source ${i+1} – ${c.document_filename}, Page ${c.page}]:\n${c.content}`)
        .join('\n\n---\n\n')

      // build messages array
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        {
          role: 'system',
          content:
            `You are an AI assistant with access to the following document context:\n\n` +
            docsContext +
            `\n\nAnswer the user's question using only this information. Cite the sources.`
        },
        { role: 'user', content: `Question: ${question}` }
      ];

      if (includeConversationContext && sessionId) {
        const { data: recent } = await supabaseClient
          .from('conversation_messages')
          .select('role, content, metadata, action_type')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);                             // we'll filter in memory

        const filtered = recent?.filter(msg =>
          msg.role === 'user' ||                          // keep all user turns
          (msg.role === 'assistant' &&
            msg.action_type === 'document_response' &&    // extra guard
            msg.metadata?.document_id === documentId &&   // same doc only
            msg.metadata?.fallback_response !== true)     // no fallbacks
        ) ?? [];

        if (filtered.length) {
          messages.splice(1, 0, ...filtered.reverse().map(m => ({
            role: m.role,
            content: m.content
          })) as any);
        }
      }

      // Call OpenAI for the response
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 1000,
          temperature: 0.2, // Lower temperature for more factual responses
        }),
      })

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
      }

      aiResult = await openaiResponse.json()
      aiAnswer = aiResult.choices[0].message.content
    }

    // 🔥 ALWAYS create conversation messages (moved outside the chunks check)
    let userMessageId = `query-user-${Date.now()}`;
    let assistantMessageId = `query-assistant-${Date.now()}`;

    if (sessionId) {
      console.log('💾 Persisting conversation messages to database...')
      
      // Generate client IDs for deduplication
      const userClientId = crypto.randomUUID()
      const assistantClientId = crypto.randomUUID()

      try {
        // Create user message
        const { data: userMessage, error: userError } = await supabaseClient
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
              sources_found: actualMatchingChunks.length,
              filename: filename
            },
            created_at: new Date().toISOString(),
            message_timestamp: new Date().toISOString(),
            client_id: userClientId
          })
          .select()
          .single()

        if (userError) {
          console.error('❌ Failed to create user message:', userError)
        } else {
          userMessageId = userMessage.id;
          console.log(`✅ Created user message: ${userMessageId}`)
        }

        // Create assistant message
        const { data: assistantMessage, error: assistantError } = await supabaseClient
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
              sources_used: actualMatchingChunks.map(chunk => ({
                document_id: chunk.document_id,
                filename: chunk.document_filename,
                page: chunk.page,
                similarity: chunk.similarity
              })),
              fallback_response: actualMatchingChunks.length === 0
            },
            raw_response: aiResult,
            created_at: new Date().toISOString(),
            message_timestamp: new Date().toISOString(),
            client_id: assistantClientId
          })
          .select()
          .single()

        if (assistantError) {
          console.error('❌ Failed to create assistant message:', assistantError)
        } else {
          assistantMessageId = assistantMessage.id;
          console.log(`✅ Created assistant message: ${assistantMessageId}`)
        }

        // Update session activity
        await supabaseClient
          .from('conversation_sessions')
          .update({
            last_message_at: new Date().toISOString(),
          })
          .eq('id', sessionId)

      } catch (persistError) {
        console.error('❌ Error persisting conversation messages:', persistError)
        // Continue with response even if persistence fails
      }
    }

    // Prepare response with sources and message IDs for frontend tracking
    const response: QueryDocumentResponse = {
      id: assistantMessageId,
      answer: aiAnswer,
      sources: actualMatchingChunks.map(chunk => ({
        documentId: chunk.document_id,
        filename: chunk.document_filename,
        page: chunk.page,
        chunkIndex: chunk.chunk_index,
        similarity: Math.round(chunk.similarity * 100) / 100,
        content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : '')
      })),
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      tokensUsed: aiResult.usage?.total_tokens || 0,
      // 🔥 NEW: Include message IDs for frontend tracking
      userMessageId: userMessageId,
      assistantMessageId: assistantMessageId
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