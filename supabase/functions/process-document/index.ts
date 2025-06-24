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

// Text extraction utilities
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Import PDF.js from jsDelivr using the correct .mjs files for Deno compatibility
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs');
    const pdfjsworker = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs');
    
    // Force worker import reference (prevents tree shaking)
    const workerType = typeof pdfjsworker;
    
    // Configure the worker source
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs';
    
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
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
    // For DOCX files, we'll extract basic text (simplified)
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    // Basic text extraction from XML structure
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  throw new Error(`Unsupported file type: ${mimeType}`);
}

// Text chunking function
function chunkText(text: string, maxTokens: number = 1000): Array<{ content: string, page: number, chunkIndex: number }> {
  const chunks: Array<{ content: string, page: number, chunkIndex: number }> = [];
  
  // Split by pages first (if page markers exist)
  const pages = text.split(/Page \d+:/);
  
  let globalChunkIndex = 0;
  
  pages.forEach((pageContent, pageIndex) => {
    if (!pageContent.trim()) return;
    
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const charsPerToken = 4;
    const maxChars = maxTokens * charsPerToken;
    
    if (pageContent.length <= maxChars) {
      // Page fits in one chunk
      chunks.push({
        content: pageContent.trim(),
        page: pageIndex === 0 ? 1 : pageIndex,
        chunkIndex: globalChunkIndex++
      });
    } else {
      // Split page into multiple chunks
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

// OpenAI embedding function
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

  const startTime = Date.now();

  try {
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role for file access
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

    const { documentId, bucketPath, filename } = await req.json() as ProcessDocumentRequest
    
    console.log(`📄 Processing document: ${documentId}`)

    // Get document record
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) {
      throw new Error('Document not found or access denied')
    }

    // Mark document as processing
    await supabaseClient.rpc('update_document_status', {
      doc_id: documentId,
      status: 'processing'
    })

    // Download file from storage
    const filePath = bucketPath || document.bucket_path
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(filePath)

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`)
    }

    // Convert blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer()
    
    console.log(`📖 Extracting text from ${document.file_type}`)
    
    // Extract text based on file type
    const extractedText = await extractTextFromFile(arrayBuffer, document.file_type)
    
    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error('No meaningful text content found in document')
    }

    console.log(`✂️ Chunking text (${extractedText.length} characters)`)
    
    // Chunk the text
    const chunks = chunkText(extractedText)
    
    if (chunks.length === 0) {
      throw new Error('No text chunks created from document')
    }

    console.log(`🧮 Generating embeddings for ${chunks.length} chunks`)
    
    // Process chunks in batches to avoid rate limits
    const batchSize = 5
    const chunkRecords = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      // Generate embeddings for batch
      const embeddingPromises = batch.map(chunk => generateEmbedding(chunk.content))
      const embeddings = await Promise.all(embeddingPromises)
      
      // Prepare database records
      const batchRecords = batch.map((chunk, index) => ({
        document_id: documentId,
        page: chunk.page,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        token_count: Math.ceil(chunk.content.length / 4), // Rough token estimation
        embedding: JSON.stringify(embeddings[index]) // Store as JSON string for pg vector
      }))
      
      chunkRecords.push(...batchRecords)
      
      // Small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`💾 Saving ${chunkRecords.length} chunks to database`)
    
    // Insert chunks in batches
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

    // Mark document as completed
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
    
    // Try to mark document as failed if we have the documentId
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