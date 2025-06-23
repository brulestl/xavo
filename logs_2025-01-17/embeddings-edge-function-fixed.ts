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

    if (req.method === 'POST') {
      const requestData = await req.json()
      
      // Handle both single and batch requests
      if (requestData.texts && Array.isArray(requestData.texts)) {
        // Batch embeddings
        const { texts, model = 'text-embedding-3-small' } = requestData
        
        if (texts.length === 0) {
          throw new Error('texts array cannot be empty')
        }

        const embeddings = []
        let totalTokens = 0

        for (const text of texts) {
          const cleanText = text.trim().substring(0, 8000)
          const embedding = await generateEmbedding(cleanText, model)
          embeddings.push(embedding)
          totalTokens += Math.ceil(cleanText.length / 4)
        }
        
        return new Response(JSON.stringify({ 
          embeddings,
          model,
          usage: { total_tokens: totalTokens }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      } else {
        // Single embedding
        const { text, model = 'text-embedding-3-small' } = requestData
        
        if (!text) {
          throw new Error('text is required')
        }

        const cleanText = text.trim().substring(0, 8000)
        const embedding = await generateEmbedding(cleanText, model)
        
        return new Response(JSON.stringify({ 
          embedding,
          model,
          usage: { total_tokens: Math.ceil(cleanText.length / 4) }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    throw new Error(`Method ${req.method} not allowed`)

  } catch (error) {
    console.error('Embeddings function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function generateEmbedding(text: string, model: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        encoding_format: 'float'
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data[0].embedding

  } catch (error) {
    console.error('OpenAI embedding error:', error)
    // Return zero vector as fallback (1536 dimensions for text-embedding-3-small)
    return new Array(1536).fill(0)
  }
} 