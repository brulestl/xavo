import { supabase } from '../lib/supabase';

export interface ProcessFileResponse {
  fileId: string;
  description: string; // Changed from ocrSnippet to description for Vision API
  success: boolean;
  chunksCreated?: number;
  error?: string;
}

export interface QueryFileResponse {
  answer: string;
  userMessageId: string;
  assistantMessageId: string;
  success: boolean;
  error?: string;
}

export interface FileProcessingProgress {
  stage: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
}

class SupabaseFileService {
  
  /**
   * Upload and process a file using the new Supabase process-file edge function
   */
  async processFile(
    fileUrl: string,
    fileType: string,
    fileName: string,
    sessionId: string,
    onProgress?: (progress: FileProcessingProgress) => void
  ): Promise<ProcessFileResponse> {
    // Declare storage path variable at function scope for cleanup access
    let storagePath: string = '';
    
    try {
      // 🚨 DEBUG: Function entry point - FIRST THING
      console.log('🚀 SUPABASE FILE SERVICE: processFile called with parameters:', {
        fileUrl: fileUrl ? fileUrl.substring(0, 50) + '...' : 'MISSING',
        fileType: fileType || 'MISSING',
        fileName: fileName || 'MISSING', 
        sessionId: sessionId ? sessionId.substring(0, 10) + '...' : 'MISSING',
        hasOnProgress: !!onProgress
      });
      console.log('🔍 SUPABASE SERVICE: Starting parameter validation...');
      
      // Validate required parameters
      if (!fileUrl || !fileType || !fileName || !sessionId) {
        const missing = [];
        if (!fileUrl) missing.push('fileUrl');
        if (!fileType) missing.push('fileType');
        if (!fileName) missing.push('fileName');
        if (!sessionId) missing.push('sessionId');
        console.error('❌ Missing parameters:', missing);
        throw new Error(`Missing required parameters: ${missing.join(', ')}`);
      }
      
      console.log('✅ Parameters validated successfully');

      console.log('🔍 Starting file processing:', {
        fileType,
        fileName,
        sessionId,
        fileUrlLength: fileUrl.length
      });

      // Get the current session to ensure we have a valid auth token
      console.log('🔐 Getting session...');
      
      let session, sessionError;
      try {
        console.log('🔐 Calling supabase.auth.getSession()...');
        const result = await supabase.auth.getSession();
        session = result.data.session;
        sessionError = result.error;
        console.log('🔐 Session call completed:', { 
          hasSession: !!session, 
          hasError: !!sessionError,
          errorMessage: sessionError?.message 
        });
      } catch (authCallError) {
        console.error('💥 Auth call failed:', authCallError);
        throw new Error(`Authentication call failed: ${authCallError instanceof Error ? authCallError.message : 'Unknown error'}`);
      }
      
      if (sessionError || !session) {
        console.error('❌ Session error:', { sessionError, hasSession: !!session });
        throw new Error('Authentication required');
      }
      
      console.log('✅ Session valid, user ID:', session.user.id);
      
      // 🔧 CRITICAL FIX: Set session on same Supabase client for authenticated uploads
      console.log('🔐 Setting session token for authenticated storage operations...');
      try {
        // Attach user JWT to this Supabase client for storage operations
        await supabase.auth.setSession({ 
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        console.log('✅ Session token attached - storage operations now authenticated');
      } catch (setSessionError) {
        console.error('💥 Failed to set session token:', setSessionError);
        throw new Error(`Failed to authenticate storage client: ${setSessionError instanceof Error ? setSessionError.message : 'Unknown error'}`);
      }

      // Generate unique storage path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = fileName.split('.').pop() || 'bin';
      storagePath = `temp-uploads/${session.user.id}/${timestamp}-${fileName}`;

      onProgress?.({
        stage: 'uploading',
        progress: 20,
        message: 'Uploading to storage...'
      });

      // Step 1: Upload file to Supabase Storage first
      console.log('📤 Uploading file to Supabase Storage...');
      
      // Check if bucket exists (informational only - don't block upload)
      try {
        console.log('🪣 Checking bucket access (informational only)...');
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        
        if (bucketError) {
          console.log('ℹ️ ListBuckets permission denied (normal for restricted users):', bucketError.message);
        } else if (!buckets || buckets.length === 0) {
          console.log('ℹ️ No buckets returned (likely permission issue) - proceeding with upload');
        } else {
          console.log('✅ Buckets accessible:', buckets.map(b => ({ name: b.name, public: b.public })));
          const fileUploadsBucket = buckets.find(b => b.name === 'file-uploads');
          if (fileUploadsBucket) {
            console.log('✅ file-uploads bucket confirmed:', { public: fileUploadsBucket.public });
          } else {
            console.log('⚠️ file-uploads not in bucket list, but proceeding anyway');
          }
        }
      } catch (bucketCheckError) {
        console.log('ℹ️ Bucket check skipped due to permissions:', bucketCheckError instanceof Error ? bucketCheckError.message : 'Unknown error');
      }
      
      // Read the file as ArrayBuffer (more reliable in React Native)
      console.log('📂 Reading local file from:', fileUrl.substring(0, 80) + '...');
      let fileData: ArrayBuffer;
      
      try {
        const response = await fetch(fileUrl);
        console.log('📂 Fetch response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to read local file: ${response.status} ${response.statusText}`);
        }
        
        // Use ArrayBuffer instead of blob for better React Native compatibility
        fileData = await response.arrayBuffer();
        console.log('📂 File data obtained:', {
          size: fileData.byteLength,
          type: 'ArrayBuffer',
          constructor: fileData.constructor.name
        });
        
      } catch (fetchError) {
        console.error('❌ File reading failed:', fetchError);
        throw new Error(`Cannot read local file: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }
      
      // Upload to Supabase Storage
      console.log('📤 Uploading to storage path:', storagePath);
      console.log('📤 File data details:', {
        size: fileData.byteLength,
        type: 'ArrayBuffer',
        constructor: fileData.constructor.name
      });
      
      try {
        console.log('📤 Calling supabase.storage.upload...');
        console.log('📤 Upload parameters:', {
          bucket: 'file-uploads',
          path: storagePath,
          dataSize: fileData.byteLength,
          contentType: fileType
        });
        
        // Test simple storage connection first
        try {
          console.log('🔌 Testing storage connection...');
          const testResult = await supabase.storage.from('file-uploads').list('', { limit: 1 });
          console.log('🔌 Storage connection test:', {
            hasData: !!testResult.data,
            hasError: !!testResult.error,
            errorMessage: testResult.error?.message
          });
        } catch (connectionTest) {
          console.warn('⚠️ Storage connection test failed:', connectionTest);
        }
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('file-uploads')
          .upload(storagePath, fileData, {
            contentType: fileType,
            upsert: false
          });
        
        console.log('📤 Upload call completed:', {
          hasData: !!uploadData,
          hasError: !!uploadError,
          errorMessage: uploadError?.message
        });
        
        if (uploadError) {
          console.error('❌ Storage upload error details:', {
            message: uploadError.message,
            storagePath: storagePath,
            fullError: uploadError
          });
          throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
        }
        
        console.log('✅ Storage upload successful:', uploadData);
      } catch (storageError) {
        console.error('💥 Storage upload exception:', storageError);
        throw new Error(`Storage upload failed: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
      }
      
      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('file-uploads')
        .getPublicUrl(storagePath);
      
      const publicFileUrl = urlData.publicUrl;
      console.log('✅ File uploaded to storage:', publicFileUrl.substring(0, 80) + '...');

      onProgress?.({
        stage: 'processing',
        progress: 50,
        message: 'Processing file with Vision AI...'
      });

      // Step 2: Call the process-file edge function with the public URL
      const requestBody = {
        fileUrl: publicFileUrl,
        fileType,
        fileName,
        sessionId
      };
      
      console.log('🔍 Calling process-file with storage URL:', {
        ...requestBody,
        fileUrl: publicFileUrl.substring(0, 50) + '...'
      });

      // Call the new process-file edge function
      const { data, error } = await supabase.functions.invoke('process-file', {
        body: requestBody,
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to process file');
      }

      if (!data.success) {
        throw new Error(data.error || 'File processing failed');
      }

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'File processed successfully!'
      });

      // Step 3: Clean up temporary storage file
      try {
        await supabase.storage
          .from('file-uploads')
          .remove([storagePath]);
        console.log('🗑️ Cleaned up temporary file from storage');
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file:', cleanupError);
        // Don't fail the whole operation for cleanup issues
      }

      return {
        fileId: data.fileId,
        description: data.description,
        chunksCreated: data.chunksCreated,
        success: true
      };

    } catch (error) {
      console.error('💥 File processing error details:', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack',
        errorType: typeof error,
        storagePath: storagePath || 'not set'
      });
      
      // Try to clean up temporary file even on error
      if (storagePath) {
        try {
          await supabase.storage
            .from('file-uploads')
            .remove([storagePath]);
          console.log('🗑️ Cleaned up temporary file after error');
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary file after error:', cleanupError);
        }
      }
      
      onProgress?.({
        stage: 'failed',
        progress: 0,
        message: 'File processing failed'
      });

      return {
        fileId: '',
        description: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Query a processed file using the new query-file edge function
   */
  async queryFile(
    question: string,
    fileId: string,
    sessionId: string
  ): Promise<QueryFileResponse> {
    try {
      // Get the current session to ensure we have a valid auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      // Call the new query-file edge function
      const { data, error } = await supabase.functions.invoke('query-file', {
        body: {
          question,
          fileId,
          sessionId
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to query file');
      }

      if (!data.success) {
        throw new Error(data.error || 'File query failed');
      }

      return {
        answer: data.answer,
        userMessageId: data.userMessageId,
        assistantMessageId: data.assistantMessageId,
        success: true
      };

    } catch (error) {
      console.error('File query error:', error);
      
      return {
        answer: '',
        userMessageId: '',
        assistantMessageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Retry Vision processing for a failed file
   */
  async retryFileProcessing(
    fileId: string,
    sessionId: string,
    onProgress?: (progress: FileProcessingProgress) => void
  ): Promise<ProcessFileResponse> {
    try {
      onProgress?.({
        stage: 'processing',
        progress: 50,
        message: 'Retrying Vision processing...'
      });

      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      // Call the process-file function with retry flag
      const { data, error } = await supabase.functions.invoke('process-file', {
        body: {
          fileId,
          sessionId,
          isRetry: true
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to retry file processing');
      }

      if (!data.success) {
        throw new Error(data.error || 'File retry failed');
      }

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'File processed successfully!'
      });

      return {
        fileId: data.fileId,
        description: data.description,
        chunksCreated: data.chunksCreated,
        success: true
      };

    } catch (error) {
      console.error('File retry error:', error);
      
      onProgress?.({
        stage: 'failed',
        progress: 0,
        message: 'Retry failed'
      });

      return {
        fileId: '',
        description: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load file metadata from the user_files table
   */
  async getFileMetadata(fileId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error) {
        throw new Error(`Failed to load file metadata: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error loading file metadata:', error);
      return null;
    }
  }

  /**
   * Load all files for a session
   */
  async getSessionFiles(sessionId: string): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('upload_date', { ascending: true });

      if (error) {
        throw new Error(`Failed to load session files: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error loading session files:', error);
      return [];
    }
  }

  /**
   * Call the query-file edge function to analyze a file
   */
  async callQueryFileFunction({
    question,
    fileId,
    sessionId,
  }: {
    question: string;
    fileId: string;
    sessionId: string;
  }): Promise<{ answer: string; sources: any[]; userMessageId: string; assistantMessageId: string }> {
    try {
      console.log('🔍 [SupabaseFileService] Calling query-file Edge Function...', { 
        question: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
        fileId: fileId.substring(0, 20) + '...',
        sessionId: sessionId.substring(0, 20) + '...',
        questionLength: question.length
      });
      console.log('🔍 [SupabaseFileService] This is the Vision auto-analysis trigger!');
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required for file query');
      }

      const SUPABASE_URL = 'https://wdhmlynmbrhunizbdhdt.supabase.co';
      const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/query-file`;
      
      console.log('🚀 [SupabaseFileService] Making HTTP request to Edge Function:', edgeFunctionUrl);
      console.log('🚀 [SupabaseFileService] Request payload:', {
        question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
        fileId,
        sessionId
      });
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question, fileId, sessionId }),
      });
      
      console.log('📡 [SupabaseFileService] Edge Function response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ query-file failed:', errorText);
        throw new Error(`Query-file failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Query-file completed successfully:', {
        hasAnswer: !!result.answer,
        sourceCount: result.sources?.length || 0,
        tokensUsed: result.tokensUsed
      });

      return {
        answer: result.answer,
        sources: result.sources || [],
        userMessageId: result.userMessageId,
        assistantMessageId: result.assistantMessageId
      };
    } catch (error) {
      console.error('💥 callQueryFileFunction error:', error);
      throw new Error(`File query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Create singleton instance
export const supabaseFileService = new SupabaseFileService(); 