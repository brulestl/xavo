import { supabase } from '../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { v4 as uuidv4 } from 'uuid';

// Ensure Buffer is available - use proper type
declare global {
  var Buffer: typeof import('buffer').Buffer;
}

export interface RAGDocument {
  id: string;
  filename: string;
  bucketPath: string;
  publicUrl?: string;
  fileSize: number;
  fileType: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  chunkCount: number;
  uploadedAt: string;
  processedAt?: string;
  metadata?: any;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  page: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  similarity?: number;
}

export interface ProcessingProgress {
  stage: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
}

export interface QueryResult {
  id: string;
  answer: string;
  sources: Array<{
    documentId: string;
    filename: string;
    page: number;
    chunkIndex: number;
    similarity: number;
    content: string;
  }>;
  tokensUsed: number;
}

class RAGFileService {
  // Validate file for RAG processing
  validateFile(file: DocumentPicker.DocumentPickerAsset): { valid: boolean; error?: string } {
    // Size limit: 2MB
    const maxSize = 2 * 1024 * 1024;
    if (file.size && file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 2MB for document processing' };
    }

    // Allowed file types for RAG
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (file.mimeType && !allowedTypes.includes(file.mimeType)) {
      return { 
        valid: false, 
        error: 'Only PDF, Word documents, and text files are supported for document analysis.' 
      };
    }

    return { valid: true };
  }

  // Robust file reading using Buffer for React Native
  private async readFileAsBuffer(uri: string): Promise<Buffer> {
    try {
      console.log('🔍 Reading file as buffer from URI:', uri);

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist at URI: ' + uri);
      }

      console.log('📄 File info:', fileInfo);

      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('📊 File read as base64, length:', base64Data.length);

      // Convert base64 to Buffer (React Native compatible)
      const buffer = Buffer.from(base64Data, 'base64');

      console.log('✅ Buffer created successfully, size:', buffer.length);
      return buffer;

    } catch (error) {
      console.error('❌ Error reading file as buffer:', error);
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Upload document and start processing
  async uploadAndProcessDocument(
    file: DocumentPicker.DocumentPickerAsset,
    userId: string,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<RAGDocument> {
    console.log('🚀 Starting robust RAG document upload for:', file.name);
    
    try {
      onProgress?.({
        stage: 'uploading',
        progress: 10,
        message: 'Preparing document for upload...'
      });

      // Create unique file path
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueId = uuidv4().substring(0, 8);
      const bucketPath = `uploads/${userId}/${timestamp}_${uniqueId}_${sanitizedFileName}`;

      console.log('📁 Bucket path:', bucketPath);

      onProgress?.({
        stage: 'uploading',
        progress: 20,
        message: 'Reading file content...'
      });

      // Read file as Buffer using robust React Native method
      const fileBuffer = await this.readFileAsBuffer(file.uri);

      onProgress?.({
        stage: 'uploading',
        progress: 50,
        message: 'Uploading to secure storage...'
      });

      console.log('☁️ Uploading to Supabase storage with Buffer...');

      // Upload directly to Supabase Storage using Buffer
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(bucketPath, fileBuffer, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('✅ File uploaded successfully:', uploadData);

      onProgress?.({
        stage: 'uploading',
        progress: 70,
        message: 'Saving document metadata...'
      });

      // Get public URL (if bucket is public, otherwise keep private)
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(bucketPath);

      console.log('💾 Saving document metadata to database...');

      // Save document metadata to database
      const { data: documentRecord, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          filename: file.name,
          bucket_path: bucketPath,
          public_url: publicUrl,
          file_size: file.size || fileBuffer.length,
          file_type: file.mimeType || 'application/octet-stream',
          processing_status: 'pending',
          metadata: {
            original_name: file.name,
            upload_timestamp: new Date().toISOString(),
            upload_method: 'buffer_direct'
          }
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database error:', dbError);
        // Clean up uploaded file if database save fails
        await supabase.storage.from('documents').remove([bucketPath]);
        throw new Error(`Database save failed: ${dbError.message}`);
      }

      console.log('✅ Document metadata saved:', documentRecord.id);

      onProgress?.({
        stage: 'processing',
        progress: 85,
        message: 'Starting document analysis...'
      });

      // Trigger document processing via Edge Function
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('❌ Authentication error:', sessionError);
        throw new Error('Authentication required for document processing');
      }

      console.log('🔐 Authentication successful, calling process-document endpoint...');

      // Get Supabase URL from environment or use the one from existing config
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co';
      const processEndpoint = `${supabaseUrl}/functions/v1/process-document`;
      
      console.log('🌐 Process endpoint:', processEndpoint);
      console.log('🔍 Request headers:', ['Content-Type', 'Authorization']);
      console.log('🔍 Request body: Present');

      const processResponse = await fetch(processEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          documentId: documentRecord.id,
          bucketPath: bucketPath,
          filename: file.name
        })
      });

      console.log('📊 Process response status:', processResponse.status);

      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        console.error('❌ Process response error:', errorText);
        throw new Error(`Document processing failed: ${errorText || processResponse.statusText}`);
      }

      const processResult = await processResponse.json();
      console.log('✅ Document processing response:', processResult);

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Document analysis completed!'
      });

      // Return the document record
      return {
        id: documentRecord.id,
        filename: documentRecord.filename,
        bucketPath: documentRecord.bucket_path,
        publicUrl: documentRecord.public_url,
        fileSize: documentRecord.file_size,
        fileType: documentRecord.file_type,
        processingStatus: 'processing', // Will be updated asynchronously
        chunkCount: 0,
        uploadedAt: documentRecord.uploaded_at,
        metadata: documentRecord.metadata
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('RAG document upload error:', error);
      
      onProgress?.({
        stage: 'failed',
        progress: 0,
        message: `Failed: ${errorMessage}`
      });
      
      throw error;
    }
  }

  // Query documents with a question
  async queryDocuments(
    question: string,
    sessionId?: string,
    documentId?: string,
    includeConversationContext: boolean = true
  ): Promise<QueryResult> {
    console.log('❓ Querying documents:', question);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('❌ Authentication error for query:', sessionError);
        throw new Error('Authentication required for document queries');
      }

      console.log('🔐 Authentication successful for query');

      // Get Supabase URL from environment or use the one from existing config
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co';
      const queryEndpoint = `${supabaseUrl}/functions/v1/query-document`;
      
      console.log('🌐 Query endpoint:', queryEndpoint);
      
      const response = await fetch(queryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          question,
          documentId,
          sessionId,
          includeConversationContext
        })
      });

      console.log('📊 Query response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Query response error:', errorText);
        throw new Error(`Document query failed: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Query successful, sources found:', result.sources?.length || 0);
      return result;

    } catch (error) {
      console.error('RAG document processing error:', error);
      throw error;
    }
  }

  // Get user's documents
  async getUserDocuments(userId: string): Promise<RAGDocument[]> {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }

      return documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        bucketPath: doc.bucket_path,
        publicUrl: doc.public_url,
        fileSize: doc.file_size,
        fileType: doc.file_type,
        processingStatus: doc.processing_status,
        processingError: doc.processing_error,
        chunkCount: doc.chunk_count,
        uploadedAt: doc.uploaded_at,
        processedAt: doc.processed_at,
        metadata: doc.metadata
      }));

    } catch (error) {
      console.error('Error fetching user documents:', error);
      throw error;
    }
  }

  // Get document processing status
  async getDocumentStatus(documentId: string): Promise<RAGDocument | null> {
    try {
      const { data: document, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch document status: ${error.message}`);
      }

      return {
        id: document.id,
        filename: document.filename,
        bucketPath: document.bucket_path,
        publicUrl: document.public_url,
        fileSize: document.file_size,
        fileType: document.file_type,
        processingStatus: document.processing_status,
        processingError: document.processing_error,
        chunkCount: document.chunk_count,
        uploadedAt: document.uploaded_at,
        processedAt: document.processed_at,
        metadata: document.metadata
      };

    } catch (error) {
      console.error('Error fetching document status:', error);
      return null;
    }
  }

  // Delete document and all its chunks
  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get document info first
      const document = await this.getDocumentStatus(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete from storage
      if (document.bucketPath) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.bucketPath]);

        if (storageError) {
          console.warn('Failed to delete file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database (this will cascade delete chunks via foreign key)
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) {
        throw new Error(`Failed to delete document: ${dbError.message}`);
      }

    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
}

export const ragFileService = new RAGFileService(); 