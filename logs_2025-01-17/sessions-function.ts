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
          // Get all active sessions for user (exclude deleted ones)
          const { data: sessions, error } = await supabaseClient
            .from('active_conversation_sessions')
            .select('*')
            .eq('user_id', user.id)
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
        // Soft delete session with 30-day scheduled deletion
        if (!sessionId) throw new Error('Session ID required')
        
        const { data, error } = await supabaseClient
          .rpc('soft_delete_session', { 
            p_session_id: sessionId, 
            p_user_id: user.id 
          })

        if (error) throw error
        
        if (!data) {
          return new Response(JSON.stringify({ 
            error: 'Session not found or already deleted' 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ 
          message: 'Session scheduled for deletion in 30 days',
          deleted: true,
          deletion_scheduled: true
        }), {
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