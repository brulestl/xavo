import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, x-tier',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
}

// Types
interface ChatRequest {
  message: string
  sessionId?: string
  actionType?: string
}

interface ChatResponse {
  id: string
  message: string
  timestamp: string
  sessionId: string
  model: string
  usage: {
    tokensUsed: number
    remainingQueries?: number
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Authentication required')
    }

    const { message, sessionId } = await req.json() as ChatRequest

    // Create session if not provided
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabaseClient
        .from('conversation_sessions')
        .insert({
          user_id: user.id,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          last_message_at: new Date().toISOString(),
          is_active: true,
          message_count: 0
        })
        .select()
        .single()

      if (sessionError) throw sessionError
      currentSessionId = newSession.id
    }

    // Store user message
    const { data: userMessage, error: userMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        session_id: currentSessionId,
        user_id: user.id,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
        message_timestamp: new Date().toISOString()
      })
      .select()
      .single()

    if (userMsgError) throw userMsgError

    // Get conversation context (last 10 messages)
    const { data: recentMessages } = await supabaseClient
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('session_id', currentSessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Build context for OpenAI
    const contextMessages = (recentMessages || [])
      .reverse()
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

    // Add current message
    contextMessages.push({ role: 'user', content: message })

    // Call OpenAI API
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
            content: `You are a corporate influence coach. Help users navigate workplace challenges, build leadership skills, and achieve career success. Be practical, empathetic, and provide actionable advice.`
          },
          ...contextMessages
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const aiResult = await openaiResponse.json()
    const aiMessage = aiResult.choices[0].message.content

    // Store AI response
    const { data: assistantMessage, error: aiMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        session_id: currentSessionId,
        user_id: user.id,
        role: 'assistant',
        content: aiMessage,
        created_at: new Date().toISOString(),
        message_timestamp: new Date().toISOString(),
        raw_response: aiResult
      })
      .select()
      .single()

    if (aiMsgError) throw aiMsgError

    // Update session activity
    await supabaseClient
      .from('conversation_sessions')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: (recentMessages?.length || 0) + 2
      })
      .eq('id', currentSessionId)

    const response: ChatResponse = {
      id: assistantMessage.id,
      message: aiMessage,
      timestamp: new Date().toISOString(),
      sessionId: currentSessionId,
      model: 'gpt-4o-mini',
      usage: {
        tokensUsed: aiResult.usage?.total_tokens || 0
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Chat function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 