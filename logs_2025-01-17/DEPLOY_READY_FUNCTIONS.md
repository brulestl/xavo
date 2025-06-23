# Ready-to-Deploy Edge Functions

## 🚀 Deploy Instructions

1. Go to: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt
2. Click "Edge Functions" in the left sidebar
3. Create the functions below

---

## 📝 Function 1: Chat Function

**Function Name:** `chat`

**Code to Copy:**

```typescript
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
```

---

## 📋 Function 2: Sessions Function

**Function Name:** `sessions`

**Code to Copy:**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, x-tier',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Authentication required')
    }

    const url = new URL(req.url)
    const sessionId = url.pathname.split('/').pop()
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        if (sessionId && sessionId !== 'sessions') {
          // Get specific session with messages
          const { data: session, error: sessionError } = await supabaseClient
            .from('conversation_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .single()

          if (sessionError) throw sessionError

          const { data: messages, error: messagesError } = await supabaseClient
            .from('conversation_messages')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

          if (messagesError) throw messagesError

          return new Response(JSON.stringify({ 
            session, 
            messages: messages || [] 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          // Get all sessions for user
          const { data: sessions, error } = await supabaseClient
            .from('conversation_sessions')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('last_message_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ sessions: sessions || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      case 'POST': {
        // Create new session
        const { title } = await req.json()
        
        const { data: newSession, error } = await supabaseClient
          .from('conversation_sessions')
          .insert({
            user_id: user.id,
            title: title || 'New Conversation',
            last_message_at: new Date().toISOString(),
            is_active: true,
            message_count: 0
          })
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify(newSession), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'PATCH': {
        // Update session (typically for renaming)
        if (!sessionId) throw new Error('Session ID required')
        
        const updateData = await req.json()
        
        const { data: updatedSession, error } = await supabaseClient
          .from('conversation_sessions')
          .update(updateData)
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify(updatedSession), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'DELETE': {
        // Delete session (soft delete by setting is_active = false)
        if (!sessionId) throw new Error('Session ID required')
        
        const { error } = await supabaseClient
          .from('conversation_sessions')
          .update({ is_active: false })
          .eq('id', sessionId)
          .eq('user_id', user.id)

        if (error) throw error

        return new Response(JSON.stringify({ message: 'Session deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        throw new Error(`Method ${req.method} not allowed`)
    }

  } catch (error) {
    console.error('Sessions function error:', error)
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

---

## ✅ After Deployment

Once both functions are deployed, they'll be available at:
- **Chat Function**: `https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/chat`
- **Sessions Function**: `https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/sessions`

## 🔧 Required Environment Variables

Make sure these are set in your Supabase project settings:
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Auto-set by Supabase
- `SUPABASE_ANON_KEY`: Auto-set by Supabase

Your app is configured to use these URLs automatically! 