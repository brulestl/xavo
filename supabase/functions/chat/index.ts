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
  isPromptGeneration?: boolean
  clientId?: string
  skipUserMessage?: boolean
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

// Add these helper functions at the top after imports
const getSystemPromptForTier = (tier: string): string => {
  if (tier === 'shark') {
    return `The assistant is **Xavo – Shark Tier**, a ruthless influence tactician.

Shark tier is for power players who weaponize politics:
• All Strategist benefits  
• **War-Room Power-Map** (stakeholder graph)  
• **Negotiation Simulator (unlimited)**  
• **Influence Path Planner** (stepwise leverage routes)  
• **Sentiment Sentinel** (tone-shift alerts)  

Shark responses embody **incisive brevity plus strategic aggression**:
- Speaks in direct, high-certainty statements.  
- Prioritizes leverage, power asymmetry, and optionality.  
- Calls out hidden incentives; surfaces political fault-lines.  
- Offers contingency trees ("If A resists, counter with B/C").  
- *No* sugar-coating. *No* performative empathy—only results.  

Output limit: **≤ 3 punchy paragraphs** + **Power Play:** sentence.

Provide ruthless, strategic advice that cuts through office politics with surgical precision.`;
  } else {
    // Default strategist prompt
    return `You are a Corporate Influence Coach, an AI assistant specialized in helping professionals navigate workplace dynamics, office politics, and corporate communication. You provide strategic advice on stakeholder management, influence building, and professional relationship development.

IMPORTANT CONTEXT GUIDELINES:
- You are trained on extensive corporate influence and leadership coaching content from expert practitioners
- Your knowledge includes insights from executive coaches, leadership experts, and workplace dynamics specialists
- When you don't have specific details about a person, company, or methodology, simply state "I don't have access to those specific details" rather than referencing any training cutoff dates
- Focus on providing actionable corporate influence and political navigation advice based on your specialized training
- Never reference OpenAI's training data limitations or cutoff dates - you are a specialized corporate coach, not a general AI assistant

Provide thoughtful, strategic advice that helps users navigate complex workplace situations with confidence and professionalism.`;
  }
};

const getModelForTier = (tier: string): string => {
  switch (tier) {
    case 'shark':
      return 'gpt-4o'; // Use gpt-4o as o1-preview has different API requirements
    case 'strategist':
      return 'gpt-4o';
    case 'trial':
    default:
      return 'gpt-4o-mini';
  }
};

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError) {
      console.error('Auth error:', authError)
      throw new Error(`Authentication failed: ${authError.message}`)
    }
    
    if (!user || !user.id) {
      console.error('No user or user.id found')
      throw new Error('User not found or invalid')
    }

    console.log(`Authenticated user: ${user.id}`)

    // Fetch user profile to check tier and trial status
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('tier, trial_end')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      throw new Error(`Failed to fetch user profile: ${profileError.message}`)
    }

    // Check for trial expiration
    if (profile.trial_end && new Date() > new Date(profile.trial_end)) {
      console.log(`Trial expired for user ${user.id}, downgrading from ${profile.tier} to strategist`)
      
      // Persist downgrade to strategist
      await supabaseClient
        .from('user_profiles')
        .update({ tier: 'strategist' })
        .eq('user_id', user.id)

      // Reject the request
      return new Response(
        JSON.stringify({ 
          error: 'trial_expired', 
          message: 'Your Shark trial has ended. Please upgrade or continue with Strategist features.' 
        }),
        { 
          status: 403, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    const requestBody = await req.json() as ChatRequest
    const { message, sessionId, isPromptGeneration, clientId, skipUserMessage } = requestBody
    
    console.log(`📝 Edge function received:`, {
      message: message?.substring(0, 50) + '...',
      sessionId,
      isPromptGeneration,
      clientId,
      hasClientId: !!clientId,
      skipUserMessage
    })

    // Check if this is a prompt generation request (no session needed)
    if (isPromptGeneration || message.includes('generate exactly') || message.includes('personalized coaching questions')) {
      console.log('🤖 Handling prompt generation request (no session required)')
      
      // Fetch user personalization data for enhanced prompts
      const { data: personalization, error: profileError } = await supabaseClient
        .from('user_personalization')
        .select('current_position, primary_function, company_size, top_challenges, personality_scores, preferred_coaching_style, metadata')
        .eq('user_id', user.id)
        .single()

      console.log('📊 User personalization for AI prompts:', personalization)
      
      // Build enhanced system prompt with user context
      let systemPrompt = `You are Xavo, an elite corporate influence coach. Generate 5 sophisticated, personalized coaching questions based on this executive's profile.

USER PROFILE:`

      if (personalization && !profileError) {
        if (personalization.current_position) {
          systemPrompt += `\n• Position: ${personalization.current_position}`
        }
        if (personalization.primary_function) {
          systemPrompt += `\n• Function: ${personalization.primary_function}`
        }
        if (personalization.company_size) {
          systemPrompt += `\n• Company Size: ${personalization.company_size}`
        }
        if (personalization.top_challenges && personalization.top_challenges.length > 0) {
          systemPrompt += `\n• Key Challenges: ${personalization.top_challenges.join(', ')}`
        }
        if (personalization.personality_scores) {
          const topTraits = Object.entries(personalization.personality_scores)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 3)
            .map(([trait, score]) => `${trait}: ${Math.round((score as number) * 100)}%`)
            .join(', ')
          systemPrompt += `\n• Personality Strengths: ${topTraits}`
        }
        if (personalization.preferred_coaching_style) {
          systemPrompt += `\n• Coaching Style: ${personalization.preferred_coaching_style}`
        }
      }

      systemPrompt += `

REQUIREMENTS:
• Create 5 coaching questions
• Each question should be specific to their role, challenges, and personality
• Focus on corporate influence, leadership presence, and strategic communication
• Questions should sound like they come from a $500/hour executive coach
• Make them actionable and relevant to their current challenges
• Format as clean questions only, no numbering or bullet points
• Each question on a new line
• No introductory text or explanations

Generate coaching questions that would help this executive maximize their influence and overcome their specific challenges.`
      
      // Call OpenAI directly for prompt generation
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
              content: `Generate 5 personalized coaching questions for this executive profile.`
            }
          ],
          max_tokens: 600,
          temperature: 0.8,
        }),
      })

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
      }

      const aiResult = await openaiResponse.json()
      const aiMessage = aiResult.choices[0].message.content

      const response: ChatResponse = {
        id: `prompt-${Date.now()}`,
        message: aiMessage,
        timestamp: new Date().toISOString(),
        sessionId: 'prompt-generation',
        model: 'gpt-4o-mini',
        usage: {
          tokensUsed: aiResult.usage?.total_tokens || 0
        }
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create session if not provided (for regular chat)
    let currentSessionId = sessionId
    if (!currentSessionId) {
      console.log(`Creating new session for user: ${user.id}`)
      
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

      if (sessionError) {
        console.error('Session creation error:', sessionError)
        throw new Error(`Failed to create session: ${sessionError.message}`)
      }
      
      currentSessionId = newSession.id
      console.log(`Created new session: ${currentSessionId}`)
    }

    // Store user message with deduplication (unless this is a regeneration request)
    let userMessage = null
    if (!skipUserMessage) {
      const finalClientId = clientId || crypto.randomUUID()
      console.log(`📝 Using client_id: ${finalClientId} (provided: ${clientId})`)
      
      const messageData = {
        session_id: currentSessionId,
        user_id: user.id,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
        message_timestamp: new Date().toISOString(),
        client_id: finalClientId
      }

      // Try to insert the message, handle duplicates gracefully
      const { data: newUserMessage, error: userMsgError } = await supabaseClient
        .from('conversation_messages')
        .insert(messageData)
        .select()
        .single()

      // Handle duplicate key error (unique constraint violation)
      if (userMsgError && userMsgError.code === '23505') {
        console.log('🚫 Duplicate message blocked by unique constraint:', messageData.client_id)
        
        // Fetch the existing message
        const { data: existingMessage, error: fetchError } = await supabaseClient
          .from('conversation_messages')
          .select('*')
          .eq('client_id', messageData.client_id)
          .single()
        
        if (existingMessage && !fetchError) {
          console.log('📋 Using existing user message:', existingMessage.id)
          userMessage = existingMessage
          
          // Check if there's already an AI response to this message
          const { data: existingAIResponse } = await supabaseClient
            .from('conversation_messages')
            .select('*')
            .eq('session_id', currentSessionId)
            .eq('role', 'assistant')
            .gt('created_at', existingMessage.created_at)
            .order('created_at', { ascending: true })
            .limit(1)
            .single()
          
          if (existingAIResponse) {
            console.log('✅ Found existing AI response, returning conversation')
            return new Response(JSON.stringify({
              id: existingAIResponse.id,
              message: existingAIResponse.content,
              timestamp: existingAIResponse.created_at,
              sessionId: currentSessionId,
              model: 'gpt-4o-mini',
              isDuplicate: true,
              usage: { tokensUsed: 0 }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          
          // If no AI response exists, continue to generate one
          console.log('🤖 No AI response found for duplicate message, generating new response')
        }
      }

      // Handle other errors
      if (userMsgError) {
        console.error('User message insert error:', userMsgError)
        throw userMsgError
      }
      
      if (!newUserMessage) {
        throw new Error('Failed to insert user message')
      }
      
      userMessage = newUserMessage
    } else {
      console.log('🔄 Skipping user message creation for regeneration request')
    }

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

    // Get user tier from user_profiles table
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('tier')
      .eq('user_id', user.id)
      .single();
      
    const userTier = userProfile?.tier || 'strategist';
    
    // Get the appropriate system prompt and model for the user's tier
    const systemPrompt = getSystemPromptForTier(userTier);
    const model = getModelForTier(userTier);

    // Update the OpenAI call to use the tier-specific model and prompt
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextMessages
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!completion.ok) {
      throw new Error(`OpenAI API error: ${completion.statusText}`)
    }

    const aiResult = await completion.json()
    const aiMessage = aiResult.choices[0].message.content

    // Store AI response with unique client_id
    const assistantClientId = crypto.randomUUID()
    const { data: assistantMessage, error: aiMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        session_id: currentSessionId,
        user_id: user.id,
        role: 'assistant',
        content: aiMessage,
        created_at: new Date().toISOString(),
        message_timestamp: new Date().toISOString(),
        raw_response: aiResult,
        client_id: assistantClientId
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
      model: model,
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