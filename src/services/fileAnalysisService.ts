import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';

// Get OpenAI API key from environment variables only
const getOpenAIApiKey = () => {
  try {
    return process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
  } catch (error) {
    console.warn('⚠️ Unable to get OpenAI API key:', error);
    return null;
  }
};

export interface AnalyzedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uri: string;
  publicUrl?: string;
  analysis?: {
    description: string;
    summary: string;
    keyPoints: string[];
    tags: string[];
    extractedText?: string;
    aiResponse: string;
  };
  uploadProgress?: number;
  isAnalyzing?: boolean;
  isRAGDocument?: boolean;
  isImageAttachment?: boolean;
  needsProcessing?: boolean;
  fileId?: string; // For Supabase file ID after processing
  description?: string; // For vision analysis preview text
  error?: string;
}

export interface FileUploadResult {
  file: AnalyzedFile;
  success: boolean;
  error?: string;
}

class FileAnalysisService {
  private openaiApiKey: string | null = null;
  private isAvailable = true;

  constructor() {
    this.openaiApiKey = getOpenAIApiKey();
    if (!this.openaiApiKey) {
      console.warn('📄 File analysis disabled - no OpenAI API key configured');
      this.isAvailable = false;
    }
  }

  // Check if the service is available
  get available(): boolean {
    return this.isAvailable && !!this.openaiApiKey;
  }

  // Upload file to Supabase Storage
  async uploadFile(
    file: DocumentPicker.DocumentPickerAsset,
    userId: string,
    sessionId?: string,
    onProgress?: (progress: number) => void
  ): Promise<AnalyzedFile> {
    try {
      // Create unique file path - handle cases where file.name might be undefined
      const fileName = file.name || 'image';
      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `uploads/${userId}/${sessionId || 'general'}/${timestamp}_${sanitizedFileName}`;

      // Simulate upload progress
      if (onProgress) {
        onProgress(10);
      }

      // Read file content for upload
      const fileUri = file.uri;
      const response = await fetch(fileUri);
      const fileBlob = await response.blob();

      if (onProgress) {
        onProgress(30);
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(storagePath, fileBlob, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      if (onProgress) {
        onProgress(50);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-files')
        .getPublicUrl(storagePath);

      if (onProgress) {
        onProgress(70);
      }

      // Save file metadata to database
      const fileRecord = {
        id: `file_${timestamp}`,
        user_id: userId,
        session_id: sessionId,
        file_name: fileName,
        file_path: storagePath,
        file_url: publicUrl,
        file_size: file.size || 0,
        file_type: file.mimeType || 'application/octet-stream',
        upload_date: new Date().toISOString(),
      };

      const { error: dbError } = await supabase
        .from('user_files')
        .insert(fileRecord);

      if (dbError) {
        console.warn('Database save failed:', dbError);
        // Continue anyway - file is uploaded
      }

      if (onProgress) {
        onProgress(100);
      }

      const analyzedFile: AnalyzedFile = {
        id: fileRecord.id,
        name: fileName,
        type: file.mimeType || 'application/octet-stream',
        size: file.size || 0,
        uri: fileUri,
        publicUrl,
        uploadProgress: 100,
      };

      return analyzedFile;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  // Analyze file content with OpenAI
  async analyzeFile(file: AnalyzedFile): Promise<AnalyzedFile> {
    if (!this.available) {
      console.warn('📄 File analysis not available');
      return {
        ...file,
        error: 'AI analysis not available - OpenAI API key not configured',
      };
    }

    try {
      const analysisResult = await this.performAIAnalysis(file);
      
      return {
        ...file,
        analysis: analysisResult,
        isAnalyzing: false,
      };
    } catch (error) {
      console.error('File analysis error:', error);
      return {
        ...file,
        error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isAnalyzing: false,
      };
    }
  }

  // Perform AI analysis based on file type
  private async performAIAnalysis(file: AnalyzedFile) {
    const fileType = file.type.toLowerCase();
    
    if (fileType.startsWith('image/')) {
      return await this.analyzeImage(file);
    } else if (fileType === 'application/pdf') {
      return await this.analyzePDF(file);
    } else if (fileType.startsWith('text/') || fileType.includes('text')) {
      return await this.analyzeTextFile(file);
    } else {
      // For other file types, analyze the filename and provide generic analysis
      return await this.analyzeGenericFile(file);
    }
  }

  // Analyze images using OpenAI Vision API
  private async analyzeImage(file: AnalyzedFile) {
    if (!file.publicUrl) {
      throw new Error('No public URL available for image analysis');
    }

    const prompt = `Analyze this image in detail. Please provide:
1. A clear description of what you see
2. A brief summary 
3. Key points or notable elements (as bullet points)
4. Relevant tags for categorization
5. How this image might be relevant to a business coaching conversation

Be thorough but concise. Format your response clearly.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: file.publicUrl } }
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || 'No analysis available';

    // Parse the structured response
    return this.parseAIResponse(aiResponse, 'image');
  }

  // Analyze PDFs (extract text first, then analyze)
  private async analyzePDF(file: AnalyzedFile) {
    // For now, we'll use the filename and provide guidance
    // In a production app, you'd want to extract PDF text using a service like PDF.js or a backend service
    
    const prompt = `I have a PDF file named "${file.name}" (${Math.round(file.size / 1024)}KB). 
Without being able to read the content directly, please provide:
1. What type of document this likely is based on the filename
2. Suggestions for how to analyze this type of document
3. Key questions I should ask about this document in a coaching context
4. Recommended next steps for working with this file

Please be helpful and specific.`;

    const response = await this.callOpenAI(prompt);
    
    return this.parseAIResponse(response, 'pdf');
  }

  // Analyze text files
  private async analyzeTextFile(file: AnalyzedFile) {
    try {
      // Try to read the text content
      let textContent = '';
      
      if (file.publicUrl) {
        try {
          const response = await fetch(file.publicUrl);
          textContent = await response.text();
        } catch (error) {
          console.warn('Could not fetch text content:', error);
        }
      }

      const prompt = textContent 
        ? `Analyze this text document:

CONTENT:
${textContent.substring(0, 3000)} ${textContent.length > 3000 ? '...(truncated)' : ''}

Please provide:
1. A clear summary of the content
2. Key insights and main points
3. Relevant themes or topics
4. How this could be useful in a coaching conversation
5. Suggested discussion topics based on this content`
        : `I have a text file named "${file.name}" (${Math.round(file.size / 1024)}KB). 
Please provide guidance on analyzing this type of document and how it might be useful in a coaching context.`;

      const response = await this.callOpenAI(prompt);
      
      return this.parseAIResponse(response, 'text', textContent.substring(0, 1000));
    } catch (error) {
      console.error('Text file analysis error:', error);
      throw error;
    }
  }

  // Analyze other file types
  private async analyzeGenericFile(file: AnalyzedFile) {
    const prompt = `I have a file named "${file.name}" of type "${file.type}" (${Math.round(file.size / 1024)}KB).
Please provide:
1. What this file type typically contains
2. How this type of file might be relevant to business coaching
3. Suggestions for discussing this file's content
4. Questions I should ask about this file
5. Recommended tools or methods for working with this file type`;

    const response = await this.callOpenAI(prompt);
    
    return this.parseAIResponse(response, 'generic');
  }

  // Helper method to call OpenAI API
  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No analysis available';
  }

  // Parse AI response into structured format
  private parseAIResponse(aiResponse: string, fileType: string, extractedText?: string) {
    // Basic parsing - in a production app, you might want more sophisticated parsing
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    let description = '';
    let summary = '';
    const keyPoints: string[] = [];
    const tags: string[] = [];

    // Simple parsing logic
    lines.forEach(line => {
      if (line.toLowerCase().includes('description') || line.toLowerCase().includes('what you see')) {
        description = line.replace(/^\d+\.\s*/, '').replace(/^.*?:\s*/, '');
      } else if (line.toLowerCase().includes('summary')) {
        summary = line.replace(/^\d+\.\s*/, '').replace(/^.*?:\s*/, '');
      } else if (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./)) {
        keyPoints.push(line.replace(/^[•\-\d\.\s]*/, ''));
      }
    });

    // Generate tags based on file type and content
    const typeTags = {
      image: ['image', 'visual', 'photo'],
      pdf: ['document', 'pdf', 'report'],
      text: ['text', 'document', 'notes'],
      generic: ['file', 'document'],
    };

    tags.push(...(typeTags[fileType as keyof typeof typeTags] || typeTags.generic));

    return {
      description: description || aiResponse.split('\n')[0] || 'File analyzed',
      summary: summary || aiResponse.substring(0, 200) + '...',
      keyPoints: keyPoints.length > 0 ? keyPoints : [aiResponse.substring(0, 100) + '...'],
      tags,
      extractedText,
      aiResponse,
    };
  }

  // Combined upload and analysis
  async uploadAndAnalyze(
    file: DocumentPicker.DocumentPickerAsset,
    userId: string,
    sessionId?: string,
    onProgress?: (progress: number) => void,
    onAnalysisStart?: () => void,
    onAnalysisComplete?: (result: AnalyzedFile) => void
  ): Promise<AnalyzedFile> {
    try {
      // Upload file first
      const uploadedFile = await this.uploadFile(file, userId, sessionId, (progress) => {
        // Upload takes 0-70% of progress
        onProgress?.(progress * 0.7);
      });

      onProgress?.(70);
      onAnalysisStart?.();

      // Mark as analyzing
      const analyzingFile = { ...uploadedFile, isAnalyzing: true };
      onAnalysisComplete?.(analyzingFile);

      onProgress?.(80);

      // Perform AI analysis
      const analyzedFile = await this.analyzeFile(uploadedFile);

      onProgress?.(100);
      onAnalysisComplete?.(analyzedFile);

      return analyzedFile;
    } catch (error) {
      console.error('Upload and analysis error:', error);
      throw error;
    }
  }

  // Validate file before upload
  validateFile(file: DocumentPicker.DocumentPickerAsset): { valid: boolean; error?: string } {
    // Size limit: 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size && file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }

    // Allowed file types
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (file.mimeType && !allowedTypes.includes(file.mimeType)) {
      return { 
        valid: false, 
        error: 'Unsupported file type. Please use images, PDFs, or text files.' 
      };
    }

    return { valid: true };
  }
}

// Create singleton instance
export const fileAnalysisService = new FileAnalysisService(); 