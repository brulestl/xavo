# 📎 File Upload & AI Analysis System Setup Guide

## Overview

The Xavo app now includes a comprehensive file upload system with AI-powered analysis capabilities. Users can upload images, PDFs, and text files through camera capture, photo library, or document picker, and receive intelligent analysis from OpenAI.

## 🚀 Features

### Enhanced File Upload UX
- **Floating Attachment Menu**: Beautiful animated menu with camera, photo, and file options
- **Real-time Progress**: Upload progress indicators and analysis status
- **File Previews**: Compact and detailed file preview components
- **Error Handling**: Comprehensive validation and error recovery

### AI-Powered Analysis
- **Image Analysis**: Uses OpenAI Vision API to analyze and describe images
- **PDF Analysis**: Provides guidance and context for PDF documents
- **Text Analysis**: Extracts insights and key points from text files
- **Smart Context**: AI analysis is automatically included in chat conversations

### File Management
- **Secure Storage**: Files stored in Supabase Storage with proper authentication
- **Database Tracking**: Metadata and analysis results stored in database
- **File Validation**: Size limits (10MB) and type restrictions for security

## 🔧 Technical Implementation

### Core Components

1. **AttachmentMenu** (`src/components/AttachmentMenu.tsx`)
   - Floating menu with camera, photo, and file options
   - Smooth animations and responsive design
   - Proper accessibility and touch targets

2. **FilePreview** (`src/components/FilePreview.tsx`)
   - Compact and full preview modes
   - Shows upload progress and analysis status
   - Displays AI analysis results with expandable view

3. **Enhanced Composer** (`src/components/Composer.tsx`)
   - Integrated attachment system
   - File preview carousel
   - Updated send functionality with attachment support

4. **FileAnalysisService** (`src/services/fileAnalysisService.ts`)
   - Handles file upload to Supabase Storage
   - Integrates with OpenAI APIs for content analysis
   - Manages file validation and error handling

### Database Schema

The system uses a `user_files` table for storing file metadata:

```sql
CREATE TABLE user_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analysis_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## ⚙️ Configuration Required

### 1. OpenAI API Key

Add your OpenAI API key to `app.json`:

```json
{
  "expo": {
    "extra": {
      "openaiApiKey": "sk-proj-your-openai-api-key-here"
    }
  }
}
```

### 2. Supabase Storage Bucket

Create a `user-files` storage bucket in your Supabase project:

1. Go to Supabase Dashboard → Storage
2. Create new bucket named `user-files`
3. Set appropriate RLS policies:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to read their own files
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 3. Database Setup

Run the SQL schema creation script:

```bash
psql -h your-supabase-host -U postgres -d postgres -f sql/create_user_files_table.sql
```

### 4. App Permissions

The app includes the necessary permissions in `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-secure-store",
      "expo-web-browser", 
      "expo-document-picker",
      "expo-camera",
      "expo-image-picker"
    ],
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Xavo uses your microphone to record voice messages for AI coaching conversations.",
        "NSCameraUsageDescription": "Xavo uses your camera to capture photos for sharing context with your AI coach."
      }
    },
    "android": {
      "permissions": [
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE", 
        "RECORD_AUDIO",
        "CAMERA"
      ]
    }
  }
}
```

## 🎯 Usage Flow

### For Users

1. **Attach Files**:
   - Tap the attachment icon in the composer
   - Choose from camera, photo library, or document picker
   - Files upload with real-time progress

2. **AI Analysis**:
   - Files are automatically analyzed by AI
   - Analysis results appear in file preview
   - Context is included in conversation

3. **Send Messages**:
   - Send text with or without attachments
   - AI analysis is automatically included
   - Chat flows naturally with file context

### For Developers

1. **File Validation**:
   ```typescript
   const validation = fileAnalysisService.validateFile(file);
   if (!validation.valid) {
     Alert.alert('Invalid File', validation.error);
     return;
   }
   ```

2. **Upload and Analysis**:
   ```typescript
   const analyzedFile = await fileAnalysisService.uploadAndAnalyze(
     file,
     userId,
     sessionId,
     onProgress,
     onAnalysisStart,
     onAnalysisComplete
   );
   ```

3. **Handle Results**:
   ```typescript
   if (analyzedFile.analysis) {
     // Use AI analysis in conversation
     const context = analyzedFile.analysis.aiResponse;
   }
   ```

## 🔒 Security Features

- **File Type Validation**: Only allows images, PDFs, and text files
- **Size Limits**: 10MB maximum file size
- **User Isolation**: Files stored with user-specific paths
- **RLS Policies**: Database-level security with Row Level Security
- **Secure URLs**: Temporary signed URLs for file access

## 📱 Supported File Types

### Images
- JPEG, JPG, PNG, GIF, WebP
- AI analysis with OpenAI Vision API
- Thumbnail previews and image optimization

### Documents  
- PDF files (analysis based on filename and context)
- Text files (content analysis)
- CSV files (structure analysis)

### Analysis Capabilities

- **Images**: Visual description, object detection, scene analysis
- **Documents**: Content summarization, key point extraction
- **Context Integration**: Analysis results integrated into chat flow

## 🚀 Performance Optimizations

- **Progressive Upload**: Real-time progress feedback
- **Concurrent Processing**: Upload and analysis happen in parallel
- **Caching**: File metadata cached for quick access
- **Lazy Loading**: Components load efficiently with proper state management

## 🛠️ Development Notes

### Testing
- Use Expo Go for development testing
- Camera and file picker work in development builds
- AI analysis requires valid OpenAI API key

### Production Deployment
- Ensure all API keys are properly configured
- Set up monitoring for file upload failures
- Configure proper storage bucket policies
- Test file size limits and validation

### Monitoring Integration
The system integrates with the existing monitoring infrastructure to track:
- File upload success/failure rates
- AI analysis performance
- User engagement with file features
- Error rates and debugging information

## 📝 Future Enhancements

- **Voice Recording**: Complete voice note functionality
- **File Search**: Search through uploaded files and analysis
- **Advanced PDF**: Full PDF text extraction and analysis
- **Collaborative Features**: File sharing between users
- **Cloud Sync**: Multi-device file synchronization

---

**Setup Complete!** 🎉

Your Xavo app now has a fully functional file upload and AI analysis system. Users can seamlessly share images, documents, and files with their AI coach for enhanced conversations and insights. 