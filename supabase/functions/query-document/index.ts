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
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
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

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question)

    // Search for relevant document chunks using vector similarity
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
      // No relevant chunks found - provide a helpful response
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

    // Prepare context from matching chunks
    const documentContext = matchingChunks
      .map((chunk, index) => 
        `[Source ${index + 1} - ${chunk.document_filename}, Page ${chunk.page}]:\n${chunk.content}`
      )
      .join('\n\n---\n\n')

    // Get conversation context if requested
    let conversationContext = ''
    if (includeConversationContext && sessionId) {
      const { data: recentMessages } = await supabaseClient
        .from('conversation_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6) // Last 3 exchanges (6 messages)

      if (recentMessages && recentMessages.length > 0) {
        conversationContext = '\n\nPrevious conversation context:\n' + 
          recentMessages
            .reverse()
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n')
      }
    }

    // Build the system prompt for the AI
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

    // Call OpenAI for the response
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
        temperature: 0.3, // Lower temperature for more factual responses
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const aiResult = await openaiResponse.json()
    const aiAnswer = aiResult.choices[0].message.content

    // Store the Q&A in conversation if session provided
    if (sessionId) {
      // Store user question
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

      // Store AI response
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

      // Update session activity
      await supabaseClient
        .from('conversation_sessions')
        .update({
          last_message_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    }

    // Prepare response with sources
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