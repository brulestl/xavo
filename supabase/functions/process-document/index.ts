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
  publicUrl?: string
  filename?: string
  chunksCreated: number
  processingTime: number
  error?: string
}

// Text extraction utilities
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    console.log(`🔍 DEBUG - Starting PDF extraction, buffer size: ${buffer.byteLength}`)
    
    // Import PDF.js from jsDelivr using the correct .mjs files for Deno compatibility
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs');
    const pdfjsworker = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs');
    
    console.log(`🔍 DEBUG - PDF.js loaded successfully`)
    
    // Force worker import reference (prevents tree shaking)
    const workerType = typeof pdfjsworker;
    
    // Configure the worker source
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs';
    
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    console.log(`🔍 DEBUG - PDF loaded, pages: ${pdf.numPages}`)
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      console.log(`🔍 DEBUG - Page ${i} text length: ${pageText.length}`)
      console.log(`🔍 DEBUG - Page ${i} first 100 chars: "${pageText.substring(0, 100)}"`)
      
      fullText += `\n\nPage ${i}:\n${pageText}`;
    }
    
    const result = fullText.trim();
    console.log(`🔍 DEBUG - Total PDF text extracted: ${result.length} characters`)
    return result;
  } catch (error) {
    console.error('❌ PDF extraction error:', error);
    console.error('❌ Error details:', error.message, error.stack);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

async function extractTextFromFile(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  console.log(`🔍 DEBUG - extractTextFromFile called with mimeType: "${mimeType}", buffer size: ${buffer.byteLength}`)
  
  if (mimeType === 'application/pdf' || mimeType === 'pdf') {
    console.log(`📄 Processing as PDF...`)
    const result = await extractTextFromPDF(buffer);
    console.log(`📄 PDF extraction result length: ${result?.length || 0}`)
    return result;
  } 
  
  if (mimeType.startsWith('text/')) {
    console.log(`📝 Processing as text file...`)
    const decoder = new TextDecoder('utf-8');
    const result = decoder.decode(buffer);
    console.log(`📝 Text file result length: ${result?.length || 0}`)
    return result;
  }
  
  if (mimeType.includes('word') || mimeType.includes('document')) {
    console.log(`📄 Processing as Word document...`)
    // For DOCX files, we'll extract basic text (simplified)
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    // Basic text extraction from XML structure
    const result = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`📄 Word document result length: ${result?.length || 0}`)
    return result;
  }
  
  console.error(`❌ Unsupported file type: ${mimeType}`)
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
      console.error(`❌ Document lookup failed:`, docError)
      throw new Error('Document not found or access denied')
    }

    console.log(`🔍 DEBUG - Document details:`, {
      id: document.id,
      filename: document.filename,
      file_type: document.file_type,
      bucket_path: document.bucket_path,
      file_size: document.file_size
    })

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
    
    // 🔍 DEBUG: Log extracted text details
    console.log(`🔍 DEBUG - Extracted text length: ${extractedText?.length || 0}`)
    console.log(`🔍 DEBUG - Text type: ${typeof extractedText}`)
    console.log(`🔍 DEBUG - First 200 chars: "${extractedText?.substring(0, 200)}"`)
    console.log(`🔍 DEBUG - Trimmed length: ${extractedText?.trim().length || 0}`)
    
    if (!extractedText || extractedText.trim().length < 10) {
      console.error(`❌ Text extraction failed - Length: ${extractedText?.length || 0}, Trimmed: ${extractedText?.trim().length || 0}`)
      throw new Error('No meaningful text content found in document')
    }

    // 🧹 CRITICAL FIX: Sanitize text to remove null bytes and control characters that break PostgreSQL
    console.log(`🧹 Sanitizing extracted text for database compatibility`)
    const sanitizedText = extractedText
      .replace(/\u0000/g, '') // Remove null bytes (\u0000) that cause "22P05" PostgreSQL errors
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
      .replace(/\uFFFD/g, '') // Remove replacement characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    console.log(`🔍 DEBUG - Sanitized text length: ${sanitizedText.length}`)
    console.log(`🔍 DEBUG - Sanitized first 200 chars: "${sanitizedText.substring(0, 200)}"`)
    
    if (!sanitizedText || sanitizedText.length < 10) {
      console.error(`❌ Text sanitization failed - Final length: ${sanitizedText?.length || 0}`)
      throw new Error('No meaningful text content after sanitization')
    }

    console.log(`✂️ Chunking sanitized text (${sanitizedText.length} characters)`)
    
    // Chunk the sanitized text
    const chunks = chunkText(sanitizedText)
    
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
      const batchRecords = batch.map((chunk, index) => {
        const embedding = embeddings[index];
        console.log(`🔍 Embedding type: ${typeof embedding}, length: ${Array.isArray(embedding) ? embedding.length : 'not array'}`);
        
        // 🔥 CRITICAL FIX: Stringify embedding array for PostgreSQL vector type
        const stringifiedEmbedding = `[${embedding.join(',')}]`;
        console.log(`🔧 Stringified embedding: ${stringifiedEmbedding.substring(0, 50)}...`);
        
        return {
          document_id: documentId,
          page: chunk.page,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          token_count: Math.ceil(chunk.content.length / 4), // Rough token estimation
          embedding: stringifiedEmbedding // Store as stringified vector for pgvector
        };
      })
      
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

    // Get public URL for the document
    const { data: { publicUrl } } = supabaseClient.storage
      .from('documents')
      .getPublicUrl(filePath)

    const response: ProcessDocumentResponse = {
      success: true,
      documentId: documentId,
      publicUrl: publicUrl,
      filename: filename || document.filename,
      chunksCreated: chunks.length,
      processingTime: processingTime
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Document processing error:', error)
    
    // Note: Cannot parse req.json() again here as body is already consumed
    // Document status will remain as 'processing' and will be cleaned up by scheduled cleanup job

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