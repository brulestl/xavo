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
interface QueryFileRequest {
  question: string
  fileId: string
  sessionId: string
}

interface QueryFileResponse {
  success: boolean
  answer: string
  userMessageId: string
  assistantMessageId: string
  sources: Array<{
    fileId: string
    fileName: string
    similarity: number
    content: string
  }>
  tokensUsed: number
  processingTime: number
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

// Generate embedding for the question
async function generateEmbedding(text: string): Promise<number[]> {
  logEvent('openai_embedding_start', 'info', 'Generating OpenAI embedding', { textLength: text.length });
  
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
    logEvent('openai_embedding_error', 'error', 'OpenAI embedding failed', { status: response.status, statusText: response.statusText });
    throw new Error(`OpenAI embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  logEvent('openai_embedding_complete', 'info', 'OpenAI embedding generated successfully', { embeddingLength: data.data[0].embedding.length });
  return data.data[0].embedding;
}

serve(async (req) => {
  logEvent('function_boot', 'info', 'Query-file function started');

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
  logEvent('request_received', 'info', 'Processing file query request');

  try {
    // Parse request body with error handling
    let requestBody: QueryFileRequest;
    try {
      logEvent('parsing_request', 'info', 'Parsing request body');
      requestBody = await req.json() as QueryFileRequest;
      logEvent('parsing_complete', 'info', 'Request body parsed successfully', {
        hasQuestion: !!requestBody.question,
        hasFileId: !!requestBody.fileId,
        hasSessionId: !!requestBody.sessionId,
        questionLength: requestBody.question?.length || 0
      });
    } catch (parseError) {
      logEvent('parsing_error', 'error', 'Failed to parse request body', { error: parseError.message });
      throw new Error('Invalid request body - must be valid JSON');
    }

        let { question, fileId, sessionId } = requestBody;

    if (!question?.trim() || !sessionId) {
      logEvent('validation_error', 'error', 'Missing required fields', {
        hasQuestion: !!question?.trim(),
        hasFileId: !!fileId,
        hasSessionId: !!sessionId
      });
      throw new Error('Missing required fields: question, sessionId');
    }

    // Initialize Supabase client
    logEvent('auth_start', 'info', 'Initializing Supabase client');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Service-role client for RPC calls
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    // Step 4: Fallback to last_file_id if fileId is not provided
    if (!fileId) {
      logEvent('fallback_lookup_start', 'info', 'No fileId provided, looking up last_file_id for session');
      
      const { data: sessionData, error: sessionError } = await serviceClient
        .from('conversation_sessions')
        .select('last_file_id')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) {
        logEvent('fallback_lookup_error', 'error', 'Failed to lookup session last_file_id', {
          error: sessionError.message,
          sessionId
        });
        throw new Error(`Failed to lookup session: ${sessionError.message}`);
      }

      if (!sessionData?.last_file_id) {
        logEvent('fallback_lookup_empty', 'error', 'No last_file_id found for session', {
          sessionId
        });
        throw new Error('No file uploaded in this session yet. Please upload a file first.');
      }

      fileId = sessionData.last_file_id;
      logEvent('fallback_lookup_complete', 'info', 'Using last_file_id from session', {
        sessionId,
        fallbackFileId: fileId
      });
    }

    // Get file metadata (service role, bypass RLS)
    logEvent('file_lookup_start', 'info', 'Looking up file metadata', { fileId });
    const { data: fileData, error: fileError } = await serviceClient
      .from('user_files')
      .select('*')
      .eq('id', fileId)
      .maybeSingle();

    if (fileError) {
      logEvent('file_lookup_error', 'error', 'Database error during file lookup', { fileError: fileError?.message });
      throw new Error(`Database error: ${fileError.message}`);
    }

    if (!fileData) {
      logEvent('file_lookup_error', 'error', 'File not found or access denied', { fileId, userId: user.id });
      throw new Error('File not found or access denied');
    }

    logEvent('file_lookup_complete', 'info', 'File metadata retrieved', { 
      fileName: fileData.file_name,
      fileType: fileData.file_type,
      fileSize: fileData.file_size
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 🖼️ IMAGE‐ONLY PATH: if this is an image, bypass vector search entirely
    // and inject the original vision analysis (the assistant's `file_response`)
    // directly as the system prompt.
    // ─────────────────────────────────────────────────────────────────────────────

    if (fileData.file_type?.startsWith('image/')) {
      logEvent('image_only_path', 'info', 'Processing image query with vision context injection');
      
      // grab the most recent assistant "file_response" for this image
      const { data: fileAnalysisMessage } = await supabaseClient
        .from('conversation_messages')
        .select('content')
        .eq('session_id', sessionId)
        .eq('role', 'assistant')
        .eq('action_type', 'file_response')
        .like('metadata->fileId', `%${fileId}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const visionDescription = fileAnalysisMessage?.content
        ?? `I see you uploaded an image named "${fileData.file_name}", but I couldn't retrieve the analysis.`;

      logEvent('vision_context_retrieved', 'info', 'Retrieved vision analysis for image', {
        hasAnalysis: !!fileAnalysisMessage?.content,
        analysisLength: visionDescription.length
      });

      // build the minimal prompt directly
      const messages = [
        { role: 'system',  content: visionDescription },
        { role: 'user',    content: question         }
      ];

      // call OpenAI with that injected vision context
      logEvent('openai_vision_call_start', 'info', 'Calling OpenAI with vision context');
      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens:  800,
          temperature: 0.2
        })
      });
      
      if (!visionResponse.ok) {
        logEvent('openai_vision_error', 'error', 'OpenAI Vision call failed', { status: visionResponse.status });
        throw new Error(`OpenAI Vision call failed: ${visionResponse.statusText}`);
      }
      
      const visionResult = await visionResponse.json();
      const answer = visionResult.choices[0].message.content;

      logEvent('openai_vision_complete', 'info', 'OpenAI vision response generated', {
        tokensUsed: visionResult.usage?.total_tokens || 0,
        responseLength: answer.length
      });

      // Check for existing user message first
      const { data: existingUserMessage } = await supabaseClient
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .eq('role', 'user')
        .eq('content', question)
        .or('action_type.eq.file_upload,action_type.eq.file_query')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let userMessage = existingUserMessage;
      if (!existingUserMessage) {
        // Create user message only if it doesn't exist
        const userClientId = crypto.randomUUID();
        const { data: newUserMessage } = await supabaseClient
          .from('conversation_messages')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            role: 'user',
            content: question,
            action_type: 'file_query',
            metadata: { 
              query_type: 'file',
              file_id: fileId,
              file_name: fileData.file_name,
              fileUrl: fileData.file_url,
              image_vision_query: true
            },
            created_at: new Date().toISOString(),
            message_timestamp: new Date().toISOString(),
            client_id: userClientId
          })
          .select()
          .single();
        userMessage = newUserMessage;
      }

      // persist the assistant's reply
      const assistantClientId = crypto.randomUUID();
      const { data: assistantMessage } = await supabaseClient
        .from('conversation_messages')
        .insert({
          session_id:       sessionId,
          user_id:          user.id,
          role:             'assistant',
          content:          answer,
          action_type:      'file_response',
          metadata: {
            fileId,
            fileName:       fileData.file_name,
            fileType:       fileData.file_type,
            fileUrl:        fileData.file_url,       // ensure process-file saved this
            queryType:      'image_injection'
          },
          raw_response:     visionResult,
          client_id:        assistantClientId,
          created_at:       new Date().toISOString(),
          message_timestamp:new Date().toISOString()
        })
        .select()
        .single();

      logEvent('image_query_complete', 'info', 'Image query completed successfully', {
        userMessageId: userMessage?.id,
        assistantMessageId: assistantMessage?.id,
        tokensUsed: visionResult.usage?.total_tokens || 0
      });

      return new Response(JSON.stringify({
        success: true,
        answer: answer,
        userMessageId: userMessage?.id || '',
        assistantMessageId: assistantMessage?.id || '',
        sources: [],
        tokensUsed: visionResult.usage?.total_tokens || 0,
        processingTime: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ▼ continue with existing text/PDF "light" or "deep" analysis logic here
    // ─────────────────────────────────────────────────────────────────────────────

    // Generate embedding for the question
    logEvent('embedding_start', 'info', 'Generating question embedding');
    const questionEmbedding = await generateEmbedding(question);
    
    // Call RPC function for vector search
    logEvent('rpc_call_start', 'info', 'Calling vector search RPC', { fileId });
    const stringifiedEmbedding = `[${questionEmbedding.join(',')}]`;
    
    const { data: matchingTexts, error: rpcError } = await serviceClient.rpc(
      'match_file_texts_rest',
      {
        p_query_embedding_text: stringifiedEmbedding,
        p_file_id: fileId,
        match_count: 5
      }
    );

    if (rpcError) {
      logEvent('rpc_call_error', 'error', 'Vector search failed', { error: rpcError.message });
      throw new Error(`File search failed: ${rpcError.message}`);
    }

    logEvent('rpc_call_complete', 'info', 'Vector search completed', { matchCount: matchingTexts?.length || 0 });

    // 🔍 Check for OCR failure fallback markers before processing
    if (matchingTexts && matchingTexts.length > 0) {
      const firstTextSlice = matchingTexts[0].text_slice?.trim() || '';
      const isOCRFailure = firstTextSlice === '[OCR failed]' || 
                          firstTextSlice === '[No text could be extracted from this image]';
      
      if (isOCRFailure) {
        logEvent('ocr_fallback_detected', 'warning', 'OCR failure detected, returning low-quality image message', { 
          fallbackText: firstTextSlice,
          fileId,
          fileName: fileData.file_name
        });
        
        const fallbackAnswer = `I'm sorry, but the image appears to be too low-quality for me to extract any text or meaningful data. Could you try uploading a clearer version of the image?

This could be due to:
• Image resolution being too low
• Text being too small or blurry
• Poor lighting or contrast
• File compression artifacts

Please try uploading a higher quality image and I'll be happy to analyze it for you!`;

        // Check for existing user message first
        const { data: existingUserMessage } = await supabaseClient
          .from('conversation_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .eq('role', 'user')
          .eq('content', question)
          .or('action_type.eq.file_upload,action_type.eq.file_query')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let userMessage = existingUserMessage;
        if (!existingUserMessage) {
          // Create user message only if it doesn't exist
          const userClientId = crypto.randomUUID();
          const { data: newUserMessage } = await supabaseClient
            .from('conversation_messages')
            .insert({
              session_id: sessionId,
              user_id: user.id,
              role: 'user',
              content: question,
              action_type: 'file_query',
              metadata: { 
                query_type: 'file',
                file_id: fileId,
                file_name: fileData.file_name,
                fileUrl: fileData.file_url, // ADDED: Include public URL
                ocr_failure: true
              },
              created_at: new Date().toISOString(),
              message_timestamp: new Date().toISOString(),
              client_id: userClientId
            })
            .select()
            .single();
          userMessage = newUserMessage;
        }

        // Create assistant message with fallback
        const assistantClientId = crypto.randomUUID();
        const { data: assistantMessage } = await supabaseClient
          .from('conversation_messages')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            role: 'assistant',
            content: fallbackAnswer,
            action_type: 'file_response',
            metadata: { 
              query_type: 'file',
              file_id: fileId,
              file_name: fileData.file_name,
              fileUrl: fileData.file_url, // ADDED: Include public URL
              fallback_reason: 'low_quality_image',
              ocr_failure: true
            },
            created_at: new Date().toISOString(),
            message_timestamp: new Date().toISOString(),
            client_id: assistantClientId
          })
          .select()
          .single();

        logEvent('ocr_fallback_complete', 'info', 'OCR fallback response created', { 
          userMessageId: userMessage?.id,
          assistantMessageId: assistantMessage?.id
        });

        // Return fallback response
        return new Response(JSON.stringify({
          success: true,
          answer: fallbackAnswer,
          userMessageId: userMessage?.id || '',
          assistantMessageId: assistantMessage?.id || '',
          sources: [],
          tokensUsed: 0,
          processingTime: Date.now() - startTime
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Prepare context for OpenAI
    let aiAnswer = '';
    let aiResult: any = { usage: { total_tokens: 0 } };
    let actualSources = matchingTexts || [];

    if (!matchingTexts || matchingTexts.length === 0) {
      logEvent('no_matches', 'warning', 'No matching text found in file');
      
      // Generate fallback response
      aiAnswer = `I can see that you've uploaded the file "${fileData.file_name}", but I'm having trouble finding relevant content to answer your question: "${question}".

This could be because:
1. The question doesn't match the content in the file
2. The file content hasn't been fully processed yet
3. The search terms used might not exist in the document

Could you try:
- Asking a more general question about the file
- Using different keywords that might be in the document
- Re-uploading the file if it seems incomplete

I'd be happy to help once I can better access the file content!`;

      aiResult = {
        usage: { total_tokens: 50 },
        choices: [{ message: { content: aiAnswer } }]
      };
    } else {
      logEvent('openai_chat_start', 'info', 'Generating OpenAI response', { sourceCount: matchingTexts.length });
      
      // Build context from matching texts
      const fileContext = matchingTexts
        .map((match, i) => `[Source ${i+1} from ${fileData.file_name}]:\n${match.text_slice}`)
        .join('\n\n---\n\n');

      // Build messages for OpenAI
      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant analyzing a file called "${fileData.file_name}". Here is the relevant content from the file:\n\n${fileContext}\n\nAnswer the user's question using only this information. Be specific and cite the sources when possible.`
        },
        {
          role: 'user',
          content: question
        }
      ];

      // Call OpenAI for the response
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 1000,
          temperature: 0.2, // Lower temperature for more factual responses
        }),
      });

      if (!openaiResponse.ok) {
        logEvent('openai_chat_error', 'error', 'OpenAI chat completion failed', { status: openaiResponse.status });
        throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
      }

      aiResult = await openaiResponse.json();
      aiAnswer = aiResult.choices[0].message.content;
      
      logEvent('openai_chat_complete', 'info', 'OpenAI response generated', { 
        tokensUsed: aiResult.usage?.total_tokens || 0,
        responseLength: aiAnswer.length
      });
    }

    // Create conversation messages (skip user message if it already exists)
    logEvent('conversation_start', 'info', 'Creating conversation messages');
    
    // Check if user message already exists for this query (to avoid duplicates from auto-analysis)
    logEvent('check_existing_message', 'info', 'Checking for existing user message', { question, sessionId, fileId });
    const { data: existingMessage, error: existingError } = await supabaseClient
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('role', 'user')
      .eq('content', question)
      .or('action_type.eq.file_upload,action_type.eq.file_query')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let userMessage;
    if (existingMessage) {
      logEvent('existing_message_found', 'info', 'Using existing user message', { messageId: existingMessage.id });
      userMessage = existingMessage;
    } else {
      // Create user message only if it doesn't exist
      logEvent('create_user_message', 'info', 'Creating new user message', { question, sessionId });
      const userClientId = crypto.randomUUID();
      const { data: newUserMessage, error: userError } = await supabaseClient
        .from('conversation_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'user',
          content: question,
          action_type: 'file_query',
          metadata: { 
            query_type: 'file',
            file_id: fileId,
            file_name: fileData.file_name,
            fileUrl: fileData.file_url, // ADDED: Include public URL
            sources_found: actualSources.length
          },
          created_at: new Date().toISOString(),
          message_timestamp: new Date().toISOString(),
          client_id: userClientId
        })
        .select()
        .single();

      if (userError) {
        logEvent('conversation_user_error', 'error', 'Failed to create user message', { error: userError.message });
        throw new Error(`Failed to create user message: ${userError.message}`);
      }

      userMessage = newUserMessage;
      logEvent('conversation_user_complete', 'info', 'User message created', { messageId: userMessage.id });
    }

    // Create assistant message
    const assistantClientId = crypto.randomUUID(); // Generate client ID for assistant message
    const { data: assistantMessage, error: assistantError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'assistant',
        content: aiAnswer,
        action_type: 'file_response',
        metadata: { 
          query_type: 'file',
          file_id: fileId,
          file_name: fileData.file_name,
          fileUrl: fileData.file_url, // ADDED: Include public URL
          sources_used: actualSources.map(source => ({
            file_id: fileId,
            similarity: source.similarity
          })),
          fallback_response: actualSources.length === 0
        },
        raw_response: aiResult,
        created_at: new Date().toISOString(),
        message_timestamp: new Date().toISOString(),
        client_id: assistantClientId
      })
      .select()
      .single();

    if (assistantError) {
      logEvent('conversation_assistant_error', 'error', 'Failed to create assistant message', { error: assistantError.message });
      throw new Error(`Failed to create assistant message: ${assistantError.message}`);
    }

    logEvent('conversation_assistant_complete', 'info', 'Assistant message created', { messageId: assistantMessage.id });

    // Update session activity
    logEvent('session_update_start', 'info', 'Updating session activity');
    await supabaseClient
      .from('conversation_sessions')
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    logEvent('session_update_complete', 'info', 'Session activity updated');

    const processingTime = Date.now() - startTime;
    logEvent('function_complete', 'info', 'File query completed successfully', { 
      processingTime,
      tokensUsed: aiResult.usage?.total_tokens || 0,
      sourceCount: actualSources.length
    });

    // Prepare response
    const response: QueryFileResponse = {
      success: true,
      answer: aiAnswer,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      sources: actualSources.map(source => ({
        fileId: fileId,
        fileName: fileData.file_name,
        similarity: Math.round(source.similarity * 100) / 100,
        content: source.text_slice.substring(0, 200) + (source.text_slice.length > 200 ? '...' : '')
      })),
      tokensUsed: aiResult.usage?.total_tokens || 0,
      processingTime: processingTime
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logEvent('function_error', 'error', 'File query failed', { 
      error: error.message,
      processingTime
    });

    return new Response(
      JSON.stringify({ 
        success: false,
        answer: '',
        userMessageId: '',
        assistantMessageId: '',
        sources: [],
        tokensUsed: 0,
        error: error.message,
        processingTime: processingTime
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } finally {
    logEvent('function_shutdown', 'info', 'Query-file function ending');
  }
}); 