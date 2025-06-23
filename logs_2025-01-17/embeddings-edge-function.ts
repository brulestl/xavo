import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, x-tier',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
}

interface EmbeddingRequest {
  text: string;
  model?: string;
}

interface BatchEmbeddingRequest {
  texts: string[];
  model?: string;
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
    const isBatch = url.pathname.includes('/batch')

    if (req.method === 'POST') {
      if (isBatch) {
        // Batch embeddings generation
        const { texts, model = 'text-embedding-3-small' } = await req.json() as BatchEmbeddingRequest
        
        if (!texts || !Array.isArray(texts) || texts.length === 0) {
          throw new Error('texts array is required for batch embeddings')
        }

        const embeddings = await generateBatchEmbeddings(texts, model)
        
        return new Response(JSON.stringify({ 
          embeddings,
          model,
          usage: {
            total_tokens: texts.reduce((acc, text) => acc + Math.ceil(text.length / 4), 0)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      } else {
        // Single embedding generation
        const { text, model = 'text-embedding-3-small' } = await req.json() as EmbeddingRequest
        
        if (!text) {
          throw new Error('text is required')
        }

        const embedding = await generateSingleEmbedding(text, model)
        
        return new Response(JSON.stringify({ 
          embedding,
          model,
          usage: {
            total_tokens: Math.ceil(text.length / 4)
          }
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

async function generateSingleEmbedding(text: string, model: string): Promise<number[]> {
  // Clean and prepare text
  const cleanText = text.trim().substring(0, 8000)
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: cleanText,
      encoding_format: 'float'
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

async function generateBatchEmbeddings(texts: string[], model: string): Promise<number[][]> {
  // Clean and prepare texts
  const cleanTexts = texts.map(text => text.trim().substring(0, 8000))
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: cleanTexts,
      encoding_format: 'float'
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data.map((item: any) => item.embedding)
} 