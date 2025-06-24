import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, x-tier',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
}

interface PromptsRequest {
  userId: string
  context: string
  count: number
}

interface PromptsResponse {
  prompts: string[]
  usage: {
    tokensUsed: number
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

    console.log(`🤖 Generating prompts for user: ${user.id}`)

    const requestBody = await req.json() as PromptsRequest
    const { userId, context, count } = requestBody

    // Fetch user personalization data
    const { data: personalization, error: profileError } = await supabaseClient
      .from('user_personalization')
      .select('current_position, primary_function, company_size, top_challenges, personality_scores, preferred_coaching_style, metadata')
      .eq('user_id', userId)
      .single()

    console.log('📊 User personalization data:', personalization)

    // Build enhanced system prompt with user context
    let systemPrompt = `You are Xavo, an elite corporate influence coach. Generate exactly ${count} sophisticated, personalized coaching questions based on this executive's profile.

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
• Generate exactly ${count} coaching questions in FIRST PERSON ("How can I..." not "How can you...")
• Each question must be specific to their role, challenges, and personality
• Focus on corporate influence, leadership presence, and strategic communication
• Questions should be actionable and sophisticated
• Use direct, personal language: "How can I...", "What should I...", "How do I..."
• Format as clean questions only, no numbering or bullet points
• Each question on a separate line
• No introductory text or explanations
• Each question should be unique and address different aspects of their development

Generate ${count} personalized coaching questions in first person that this professional can ask their coach directly.`

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
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Generate exactly ${count} personalized coaching questions for this professional profile. Each question should be on a separate line.`
          }
        ],
        max_tokens: 800,
        temperature: 0.8,
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const aiResult = await openaiResponse.json()
    const aiMessage = aiResult.choices[0].message.content

    console.log('🤖 Raw OpenAI response:', aiMessage)

    // Parse the response into individual questions
    const questions = aiMessage
      .split('\n')
      .map((line: string) => line.replace(/^[\d\.\-\s\*\•\>\#]+/, '').trim())
      .filter((line: string) => {
        return line.includes('?') && 
               line.length >= 10 && 
               line.length <= 200 &&
               line.trim().length > 0
      })
      .slice(0, count)

    console.log('✅ Parsed questions:', questions)

    // Ensure we have the requested number of questions
    if (questions.length < count) {
      console.log(`⚠️ Only got ${questions.length} questions, adding fallbacks...`)
      
      const fallbacks = [
        "How can I leverage my expertise to build stronger stakeholder relationships?",
        "What communication strategies would amplify my influence in meetings?",
        "How can I better position myself for upcoming leadership opportunities?",
        "What specific actions would strengthen my professional brand?",
        "How can I navigate organizational politics more effectively?"
      ]
      
      // Add fallbacks until we reach the desired count
      while (questions.length < count && fallbacks.length > 0) {
        const fallback = fallbacks.shift()
        if (fallback && !questions.includes(fallback)) {
          questions.push(fallback)
        }
      }
    }

    const response: PromptsResponse = {
      prompts: questions.slice(0, count),
      usage: {
        tokensUsed: aiResult.usage?.total_tokens || 0
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Prompts function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 