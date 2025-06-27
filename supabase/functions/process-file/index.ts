import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// CORS headers for web requests (removed Tesseract import due to Deno Edge compatibility issues)

// CORS headers for web requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Types
interface ProcessFileRequest {
  fileUrl: string
  fileType: string
  fileName: string
  sessionId: string
  fileId?: string
  isRetry?: boolean
}

interface ProcessFileResponse {
  success: boolean
  fileId: string
  description: string
  processingTime: number
  chunksCreated?: number
  error?: string
}

// Structured logging function
function logEvent(eventType: string, level: 'info' | 'warning' | 'error', eventMessage: string, metadata?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event_type: eventType,
    level: level,
    event_message: eventMessage,
    metadata: metadata || {}
  };
  console.log(JSON.stringify(logEntry));
}

// OpenAI Vision API function - DIRECT URL IMPLEMENTATION
async function analyzeImageWithVision(imageUrl: string, mimeType: string, fileName: string): Promise<string> {
  logEvent('vision_start', 'info', `Starting OpenAI Vision analysis for type: ${mimeType}`, {
    imageUrl: imageUrl.substring(0, 100) + '...',
    fileName
  });
  
  try {
    // Call OpenAI Chat Completions API directly with image URL
    logEvent('vision_analysis_start', 'info', 'Starting vision analysis with direct image URL');
    
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Analyze this image thoroughly. Describe what you see including any text, visual elements, layout, colors, objects, and any other relevant details. Be comprehensive but concise. Extract all visible text if any.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high' // High detail for better text extraction
              }
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.1, // Low temperature for more consistent results
    };

    logEvent('vision_request_debug', 'info', 'Vision API request details', {
      model: requestBody.model,
      imageUrlLength: imageUrl.length,
      detail: 'high',
      maxTokens: requestBody.max_tokens
    });

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Log raw response details
    logEvent('vision_response_debug', 'info', 'Vision API response details', {
      status: analysisResponse.status,
      statusText: analysisResponse.statusText,
      headers: Object.fromEntries(analysisResponse.headers.entries())
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      logEvent('vision_analysis_error', 'error', `Vision analysis failed: ${analysisResponse.statusText}`, { 
        status: analysisResponse.status,
        statusText: analysisResponse.statusText,
        errorBody: errorText,
        imageUrl: imageUrl.substring(0, 100) + '...'
      });
      throw new Error(`Vision analysis failed (${analysisResponse.status}): ${errorText}`);
    }

    const analysisData = await analysisResponse.json();
    
    // Log the full raw response for debugging
    logEvent('vision_raw_response', 'info', 'Raw Vision API response', {
      fullResponse: analysisData,
      hasChoices: !!analysisData.choices,
      choicesLength: analysisData.choices?.length,
      firstChoice: analysisData.choices?.[0],
      usage: analysisData.usage
    });

    const description = analysisData.choices?.[0]?.message?.content;
    
    if (!description || description.trim().length === 0) {
      logEvent('vision_empty_response', 'warning', 'Vision API returned empty description', {
        analysisData,
        choices: analysisData.choices
      });
      throw new Error('Vision API returned empty description');
    }
    
    logEvent('vision_analysis_complete', 'info', `Vision analysis completed successfully`, {
      descriptionLength: description.length,
      tokensUsed: analysisData.usage?.total_tokens || 0,
      model: analysisData.model
    });

    return description;
  } catch (error) {
    logEvent('vision_error', 'error', `Vision analysis failed: ${error.message}`, { 
      errorType: error.constructor.name,
      errorStack: error.stack,
      fileName,
      mimeType
    });
    
    // Re-throw with more context
    throw new Error(`Vision analysis failed for ${fileName}: ${error.message}`);
  }
}

// Text extraction utilities - UPDATED for Vision API
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    logEvent('pdf_start', 'info', `Starting PDF extraction, buffer size: ${buffer.byteLength}`);
    
    // Import PDF.js from jsDelivr using the correct .mjs files for Deno compatibility
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs');
    const pdfjsworker = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs');
    
    logEvent('pdf_loaded', 'info', 'PDF.js loaded successfully');
    
    // Force worker import reference (prevents tree shaking)
    const workerType = typeof pdfjsworker;
    
    // Configure the worker source
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs';
    
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    logEvent('pdf_parsed', 'info', `PDF loaded, pages: ${pdf.numPages}`);
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      logEvent('pdf_page', 'info', `Page ${i} text length: ${pageText.length}`);
      
      fullText += `\n\nPage ${i}:\n${pageText}`;
    }
    
    const result = fullText.trim();
    logEvent('pdf_complete', 'info', `Total PDF text extracted: ${result.length} characters`);
    return result;
  } catch (error) {
    logEvent('pdf_error', 'error', `PDF extraction failed: ${error.message}`, { error: error.stack });
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

async function extractContentFromFile(buffer: ArrayBuffer, mimeType: string, fileName: string, imageUrl?: string): Promise<string> {
  logEvent('extraction_start', 'info', `Starting content extraction for type: ${mimeType}, size: ${buffer.byteLength}`);
  
  // For images, use OpenAI Vision API with direct URL
  if (mimeType.startsWith('image/')) {
    if (!imageUrl) {
      throw new Error('Image URL required for vision analysis');
    }
    return await analyzeImageWithVision(imageUrl, mimeType, fileName);
  }
  
  // For PDFs, continue using PDF.js text extraction
  if (mimeType === 'application/pdf' || mimeType === 'pdf') {
    return await extractTextFromPDF(buffer);
  } 
  
  // For text files, extract directly
  if (mimeType.startsWith('text/')) {
    logEvent('extraction_text', 'info', 'Processing as text file');
    const decoder = new TextDecoder('utf-8');
    const result = decoder.decode(buffer);
    logEvent('extraction_text_complete', 'info', `Text file processed, length: ${result.length}`);
    return result;
  }
  
  // For Word documents, basic text extraction
  if (mimeType.includes('word') || mimeType.includes('document')) {
    logEvent('extraction_word', 'info', 'Processing as Word document');
    // For DOCX files, we'll extract basic text (simplified)
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    // Basic text extraction from XML structure
    const result = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    logEvent('extraction_word_complete', 'info', `Word document processed, length: ${result.length}`);
    return result;
  }
  
  logEvent('extraction_unsupported', 'error', `Unsupported file type: ${mimeType}`);
  throw new Error(`Unsupported file type: ${mimeType}`);
}

// Text chunking function - ~1000 tokens = ~4000 characters
function chunkText(text: string, maxChars: number = 4000): Array<{ content: string, chunkIndex: number, tokenCount: number }> {
  const chunks: Array<{ content: string, chunkIndex: number, tokenCount: number }> = [];
  
  if (text.length <= maxChars) {
    // Text fits in one chunk
    chunks.push({
      content: text.trim(),
      chunkIndex: 0,
      tokenCount: Math.ceil(text.length / 4) // Rough token estimation
    });
    return chunks;
  }
  
  // Split text into sentences for better chunking
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    const sentenceWithPunct = sentence.trim() + '.';
    
    // If adding this sentence would exceed the limit and we have content, start a new chunk
    if ((currentChunk + ' ' + sentenceWithPunct).length > maxChars && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        tokenCount: Math.ceil(currentChunk.length / 4)
      });
      currentChunk = sentenceWithPunct;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunct;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex: chunkIndex,
      tokenCount: Math.ceil(currentChunk.length / 4)
    });
  }
  
  return chunks;
}

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  logEvent('embedding_start', 'info', `Generating embedding for text length: ${text.length}`);
  
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
    logEvent('embedding_error', 'error', `OpenAI embedding failed: ${response.statusText}`);
    throw new Error(`OpenAI embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  logEvent('embedding_complete', 'info', 'Embedding generated successfully');
  return data.data[0].embedding;
}

serve(async (req) => {
  logEvent('function_boot', 'info', 'Process-file function started');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logEvent('cors_preflight', 'info', 'Handling CORS preflight request');
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
  logEvent('request_received', 'info', 'Processing file upload request');

  try {
    // Parse request body with error handling
    let requestBody: ProcessFileRequest;
    try {
      logEvent('parsing_request', 'info', 'Parsing request body');
      
      // Debug: Check content type and method
      const contentType = req.headers.get('content-type');
      const method = req.method;
      logEvent('request_debug', 'info', 'Request details', { 
        method, 
        contentType, 
        hasBody: req.body !== null 
      });
      
      // Get raw text first to debug
      const rawText = await req.text();
      logEvent('raw_body_debug', 'info', 'Raw request body', { 
        bodyLength: rawText.length,
        bodyPreview: rawText.substring(0, 200)
      });
      
      if (!rawText || rawText.trim() === '') {
        throw new Error('Empty request body received');
      }
      
      requestBody = JSON.parse(rawText) as ProcessFileRequest;
      logEvent('parsing_complete', 'info', 'Request body parsed successfully', {
        fileType: requestBody.fileType,
        fileName: requestBody.fileName,
        hasFileUrl: !!requestBody.fileUrl,
        isRetry: requestBody.isRetry
      });
    } catch (parseError) {
      logEvent('parsing_error', 'error', 'Failed to parse request body', { error: parseError.message });
      throw new Error('Invalid request body - must be valid JSON');
    }

    const { fileUrl, fileType, fileName, sessionId, fileId, isRetry } = requestBody;

    if (!fileUrl || !fileType || !fileName || !sessionId) {
      logEvent('validation_error', 'error', 'Missing required fields', { fileUrl: !!fileUrl, fileType: !!fileType, fileName: !!fileName, sessionId: !!sessionId });
      throw new Error('Missing required fields: fileUrl, fileType, fileName, sessionId');
    }

    // Initialize Supabase client
    logEvent('auth_start', 'info', 'Initializing Supabase client');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logEvent('auth_error', 'error', 'Missing authorization header');
      throw new Error('Authorization header required');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      logEvent('auth_error', 'error', 'Authentication failed', { authError: authError?.message });
      throw new Error('Authentication required');
    }

    logEvent('auth_success', 'info', 'User authenticated', { userId: user.id });

    // Generate file ID
    const processFileId = fileId || crypto.randomUUID();
    logEvent('file_id_generated', 'info', 'File ID assigned', { fileId: processFileId, isRetry });

    // Download file from URL
    logEvent('download_start', 'info', 'Starting file download', { fileUrl: fileUrl.substring(0, 100) + '...' });
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      logEvent('download_error', 'error', 'File download failed', { status: fileResponse.status, statusText: fileResponse.statusText });
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    logEvent('download_complete', 'info', 'File downloaded successfully', { size: fileBuffer.byteLength });

    // Use the provided fileUrl directly for Vision API (it's already the public URL)
    logEvent('using_provided_file_url', 'info', 'Using provided file URL for Vision API', { 
      fileUrl: fileUrl.substring(0, 100) + '...' 
    });

    // Extract content using Vision API or other methods
    logEvent('content_extraction_start', 'info', 'Starting content extraction', { fileType, fileName });
    let extractedContent: string;
    
    try {
      extractedContent = await extractContentFromFile(fileBuffer, fileType, fileName, fileUrl);
      
      if (!extractedContent || extractedContent.trim().length < 10) {
        logEvent('content_extraction_warning', 'warning', 'Content extraction returned too little text, falling back');
        
        // More graceful fallback message
        if (fileType.startsWith('image/')) {
          extractedContent = `I can see you've uploaded an image called "${fileName}", but I'm having trouble analyzing its content. This could be due to image quality, resolution, or processing limitations. Please try uploading a clearer, higher-resolution version of the image.`;
        } else {
          extractedContent = `I can see you've uploaded a file called "${fileName}", but I'm having trouble extracting its content. Please ensure the file is not corrupted and try again.`;
        }
      }
    } catch (extractionErr) {
      logEvent('content_extraction_error', 'error', 'Content extraction failed completely', {
        error: extractionErr.message,
        errorStack: extractionErr.stack,
        fileType,
        fileName
      });
      
      // More helpful error messages based on file type
      if (fileType.startsWith('image/')) {
        extractedContent = `I encountered an error while trying to analyze the image "${fileName}". This might be due to image format issues, size limitations, or temporary processing problems. Please try uploading the image again, or try a different format (JPEG, PNG, etc.).`;
      } else {
        extractedContent = `I encountered an error while processing the file "${fileName}". The file might be corrupted, in an unsupported format, or too large. Please check the file and try again.`;
      }
    }

    // Sanitize content for database compatibility
    logEvent('content_sanitization', 'info', 'Sanitizing extracted content for database');
    const sanitizedContent = extractedContent
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\uFFFD/g, '') // Remove replacement characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    const contentSnippet = sanitizedContent.substring(0, 200) + (sanitizedContent.length > 200 ? '...' : '');
    logEvent('content_sanitization_complete', 'info', 'Content sanitization completed', { 
      originalLength: extractedContent.length,
      sanitizedLength: sanitizedContent.length,
      snippetLength: contentSnippet.length
    });

    // Save to user_files table
    logEvent('db_write_start', 'info', 'Saving file metadata to database');
    const { data: fileRecord, error: dbError } = await supabaseClient
      .from('user_files')
      .insert({
        id: processFileId,
        user_id: user.id,
        session_id: sessionId,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileBuffer.byteLength,
        file_type: fileType,
        upload_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      logEvent('db_write_error', 'error', 'Failed to save file metadata', { error: dbError.message });
      throw new Error(`Database save failed: ${dbError.message}`);
    }

    logEvent('db_write_complete', 'info', 'File metadata saved successfully', { fileId: processFileId });

    // Chunk the content into ~1000-token slices
    logEvent('chunking_start', 'info', 'Chunking content into slices');
    const chunks = chunkText(sanitizedContent);
    logEvent('chunking_complete', 'info', `Created ${chunks.length} chunks`);

    // Generate embeddings and insert chunks
    logEvent('embedding_start', 'info', 'Generating embeddings for chunks');
    const batchSize = 5; // Process embeddings in batches to avoid rate limits
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      logEvent('embedding_batch', 'info', `Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
      
      // Generate embeddings for batch
      const embeddingPromises = batch.map(chunk => generateEmbedding(chunk.content));
      const embeddings = await Promise.all(embeddingPromises);
      
      // Prepare database records
      const records = batch.map((chunk, index) => {
        const embedding = embeddings[index];
        const stringifiedEmbedding = `[${embedding.join(',')}]`;
        
        return {
          file_id: processFileId,
          chunk_index: chunk.chunkIndex,
          text_slice: chunk.content, // Note: using text_slice to match RPC function
          embedding: stringifiedEmbedding,
          token_count: chunk.tokenCount,
          created_at: new Date().toISOString()
        };
      });
      
      // Insert batch into file_texts
      const { error: insertError } = await supabaseClient
        .from('file_texts')
        .insert(records);
      
      if (insertError) {
        logEvent('embedding_error', 'error', 'Failed to save text chunks', { error: insertError.message });
        throw new Error(`Failed to save text chunks: ${insertError.message}`);
      }
      
      // Small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logEvent('embedding_complete', 'info', `Inserted ${chunks.length} text chunks with embeddings`);

    // Log file_upload in conversation_messages
    logEvent('conversation_start', 'info', 'Logging file_upload message');
    const clientId = crypto.randomUUID();
    await supabaseClient.from("conversation_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: `File uploaded: ${fileName}`,
      action_type: "file_upload",
      metadata: {
        fileId: processFileId,
        fileName,
        fileType,
        description: contentSnippet,
        chunksCreated: chunks.length
      },
      client_id: clientId,
      message_timestamp: new Date().toISOString()
    });

    logEvent('conversation_complete', 'info', 'Conversation message created successfully');

    const processingTime = Date.now() - startTime;
    logEvent('function_complete', 'info', 'File processing completed successfully', { 
      processingTime,
      fileId: processFileId,
      contentLength: sanitizedContent.length
    });

    const response: ProcessFileResponse = {
      success: true,
      fileId: processFileId,
      description: contentSnippet,
      processingTime,
      chunksCreated: chunks.length
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logEvent('function_error', 'error', 'File processing failed', { 
      error: error.message,
      processingTime
    });

    return new Response(
      JSON.stringify({ 
        success: false,
        fileId: '',
        description: '',
        error: error.message,
        processingTime: processingTime
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } finally {
    logEvent('function_shutdown', 'info', 'Process-file function ending');
  }
}); 