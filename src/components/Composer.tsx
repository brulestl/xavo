import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard, Alert, Pressable, Text, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { fileAnalysisService, AnalyzedFile } from '../services/fileAnalysisService';
import { ragFileService, RAGDocument, ProcessingProgress } from '../services/ragFileService';
import { supabaseFileService, FileProcessingProgress } from '../services/supabaseFileService';
import { supabase } from '../lib/supabase';
import { AttachmentMenu } from './AttachmentMenu';
import { FilePreview } from './FilePreview';
import { PDFProcessingErrorDialog } from './PDFProcessingErrorDialog';
import { monitoring } from '../services/monitoring';

// Safely import constants
let Constants: any = null;
try {
  Constants = require('expo-constants').default;
} catch (error) {
  console.warn('⚠️ expo-constants not available:', error);
}

// Add this constant at the top after imports
const IS_EXPO_GO = __DEV__ && !Constants.appOwnership;

interface ComposerProps {
  onSend: (message: string, attachments?: AnalyzedFile[]) => void;
  onSendFile?: (file: any) => void;
  onSendCombinedFileAndText?: (file: any, text: string, textMessageId: string, fileMessageId: string) => void;
  onAddOptimisticMessage?: (message: any) => void;
  onCreateSession?: (title?: string) => Promise<{ id: string; title: string } | null>;
  placeholder?: string;
  disabled?: boolean;
  sessionId?: string;
  isRecording?: boolean;
  liveTranscription?: string;
  isProcessingFile?: boolean;
  setFileProcessingState?: (isProcessing: boolean) => void;
  onAutoAnalysisComplete?: (sessionId: string) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onSendFile,
  onSendCombinedFileAndText,
  onAddOptimisticMessage,
  onCreateSession,
  placeholder = "What's on your mind?",
  disabled = false,
  sessionId,
  isRecording,
  liveTranscription,
  isProcessingFile,
  setFileProcessingState,
  onAutoAnalysisComplete,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AnalyzedFile[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [localLiveTranscription, setLocalLiveTranscription] = useState('');
  const [showPDFErrorDialog, setShowPDFErrorDialog] = useState(false);
  const [failedFileName, setFailedFileName] = useState<string>('');
  const focusAnim = useRef(new Animated.Value(0)).current;
  const textInputRef = useRef<TextInput>(null);

  // Use live transcription if provided, otherwise use message state
  const displayText = liveTranscription || localLiveTranscription || message;
  const isCurrentlyRecording = isRecording || false;

  // Check if error is related to PDF text extraction
  const isPDFTextExtractionError = (error: any): boolean => {
    const errorMessage = error?.message || error?.toString() || '';
    return errorMessage.includes('No meaningful text content found') ||
           errorMessage.includes('unsupported Unicode escape sequence') ||
           errorMessage.includes('\\u0000 cannot be converted to text') ||
           errorMessage.includes('Failed to save chunks');
  };

  // Handle PDF processing errors with custom dialog
  const handlePDFProcessingError = (fileName: string, error: any) => {
    if (isPDFTextExtractionError(error)) {
      setFailedFileName(fileName);
      setShowPDFErrorDialog(true);
    } else {
      // Fallback to generic error for other types of failures
      Alert.alert('Processing Failed', `Failed to process ${fileName}. Please try again.`);
    }
  };

  // Handle "Try Pasting" action from PDF error dialog
  const handleTryPasting = () => {
    setShowPDFErrorDialog(false);
    // Focus the text input to encourage pasting
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 300);
  };

  const handleInputAreaPress = () => {
    if (textInputRef.current && !disabled && !liveTranscription && !localLiveTranscription) {
      textInputRef.current.focus();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleSend = async () => {
    console.log('🚀 [Composer] handleSend called');
    
    const textToSend = liveTranscription || localLiveTranscription || message;
    console.log('🔍 [Composer] Send conditions:', {
      textToSend: textToSend.trim(),
      attachedFilesLength: attachedFiles.length,
      disabled,
      hasTextOrFiles: textToSend.trim() || attachedFiles.length > 0
    });
    
    if ((textToSend.trim() || attachedFiles.length > 0) && !disabled) {
      
      // Check if we have RAG documents and images to process
      const ragDocuments = attachedFiles.filter(file => file.isRAGDocument);
      const imageAttachments = attachedFiles.filter(file => file.isImageAttachment);
      const otherFiles = attachedFiles.filter(file => !file.isRAGDocument && !file.isImageAttachment);
      
      console.log('📁 [Composer] File breakdown:', {
        ragDocuments: ragDocuments.length,
        imageAttachments: imageAttachments.length,
        otherFiles: otherFiles.length,
        totalFiles: attachedFiles.length
      });
      
      // 🔥 NEW: Unified RAG flow - Combined file + text
      if (ragDocuments.length === 1 && textToSend.trim() && imageAttachments.length === 0 && otherFiles.length === 0 && onSendCombinedFileAndText && onAddOptimisticMessage && user?.id) {
        const ragFile = ragDocuments[0];
        try {
          // Generate unique IDs for both bubbles
          const textMessageId = `temp-text-${Date.now()}`;
          const fileMessageId = `temp-file-${Date.now()}`;
          
          // 1. Create optimistic user text bubble
          const textMessage = {
            id: textMessageId,
            content: textToSend.trim(),
            role: 'user',
            session_id: sessionId || 'temp-session',
            created_at: new Date().toISOString(),
            type: 'text',
            status: 'sent'
          };
          
          // 2. Create optimistic file bubble
          const fileMessage = {
            id: fileMessageId,
            content: ragFile.name,
            role: 'user',
            session_id: sessionId || 'temp-session',
            created_at: new Date().toISOString(),
            type: 'file',
            filename: ragFile.name,
            fileUrl: ragFile.uri,
            fileSize: ragFile.size,
            fileType: ragFile.type,
            status: 'uploading'
          };
          
          // Add both bubbles to UI immediately
          onAddOptimisticMessage(textMessage);
          onAddOptimisticMessage(fileMessage);
          
          // Convert to the format expected by unified function
          const fileForUpload = {
            name: ragFile.name,
            mimeType: ragFile.type,
            size: ragFile.size,
            uri: ragFile.uri,
            type: ragFile.type
          };
          
          // Clear attachments immediately
          setAttachedFiles([]);
          
          // Use the unified file + text flow with existing message IDs
          await onSendCombinedFileAndText(fileForUpload, textToSend.trim(), textMessageId, fileMessageId);
          
        } catch (error) {
          console.error('Combined file + text error:', error);
          // Use custom PDF error dialog for text extraction issues
          handlePDFProcessingError(ragFile.name, error);
        }
        
        setMessage('');
        setLocalLiveTranscription('');
        Keyboard.dismiss();
        return;
      }
      
      // 🆕 NEW SUPABASE FILE FLOW: Single file + text or file only
      const allFiles = [...ragDocuments, ...imageAttachments];
      console.log('🔍 [Composer] SUPABASE FILE FLOW conditions:', {
        allFilesLength: allFiles.length,
        hasOnAddOptimisticMessage: !!onAddOptimisticMessage,
        hasUserId: !!user?.id,
        hasSessionId: !!sessionId,
        sessionId,
        userId: user?.id?.substring(0, 10) + '...'
      });
      
      if (allFiles.length === 1 && onAddOptimisticMessage && user?.id) {
        console.log('✅ [Composer] Entering SUPABASE FILE FLOW (with session handling)');
        const file = allFiles[0];
        
        // 🔧 CRITICAL FIX: Ensure session exists BEFORE any optimistic messages or processing
        let targetSessionId = sessionId;
        
        if (!targetSessionId) {
          if (!onCreateSession) {
            console.error('💥 [Composer] No onCreateSession prop provided');
            Alert.alert('Error', 'Cannot create new conversation. Missing session handler.');
            return;
          }
          
          try {
            console.log('🆕 [Composer] Creating session BEFORE file processing...');
            const newSession = await onCreateSession(`Image: ${file.name}`);
            
            if (!newSession) {
              throw new Error('Failed to create new session');
            }
            
            targetSessionId = newSession.id;
            console.log('✅ [Composer] Session created successfully:', targetSessionId);
          } catch (sessionError) {
            console.error('💥 [Composer] Session creation failed:', sessionError);
            Alert.alert('Error', 'Failed to create new conversation. Please try again.');
            return;
          }
        }
        
        // 🔧 CRITICAL FIX: Handle session creation when sessionId is missing
        const executeFileFlow = async (confirmedSessionId: string) => {
          try {
            // Set file processing state at the start
            setFileProcessingState?.(true);
            
            // React Native compatible UUID generation function
            const generateUUID = (): string => {
              return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              });
            };
            
            const textMessageId = textToSend.trim() ? generateUUID() : '';
            const fileMessageId = generateUUID();
            
            console.log('🆔 [Composer] Generated UUIDs:', { textMessageId, fileMessageId, confirmedSessionId });
            
            // Add optimistic text message if there's text
            if (textToSend.trim()) {
              const textMessage = {
                id: textMessageId,
                content: textToSend.trim(),
                role: 'user',
                session_id: confirmedSessionId,
                created_at: new Date().toISOString(),
                type: 'text',
                status: 'sent'
              };
              onAddOptimisticMessage(textMessage);
            }
            
            // Add optimistic file bubble with uploading status
            const fileMessage = {
              id: fileMessageId,
              content: file.name,
              role: 'user',
              session_id: confirmedSessionId,
              created_at: new Date().toISOString(),
              type: 'file',
              filename: file.name,
              fileUrl: file.uri,
              fileSize: file.size,
              fileType: file.type,
              status: 'uploading'
            };
            onAddOptimisticMessage(fileMessage);
            
            // Clear attachments immediately 
            setAttachedFiles([]);
            
            // Process file using new Supabase edge functions
            console.log(`📄 Processing file: ${file.name} (${file.type}) with session: ${confirmedSessionId}`);
            console.log('🔍 File details before processing:', {
              fileName: file.name,
              fileType: file.type,
              fileUri: file.uri.substring(0, 50) + '...',
              fileSize: file.size,
              sessionId: confirmedSessionId,
              uriLength: file.uri.length
            });
            
            console.log('🎬 About to call supabaseFileService.processFile...');
            console.log('🔧 Service parameters:', {
              fileUri: file.uri,
              fileType: file.type,
              fileName: file.name,
              sessionId: confirmedSessionId
            });
            
            let result;
            try {
              console.log('🚀 CALLING supabaseFileService.processFile NOW...');
              let lastStage: string | null = null;
              result = await supabaseFileService.processFile(
                file.uri,
                file.type,
                file.name,
                confirmedSessionId,
                (progress: FileProcessingProgress) => {
                  console.log(`📄 File processing: ${progress.stage} - ${progress.message}`);
                  // Only emit on actual stage changes to prevent duplicate messages
                  if (progress.stage !== lastStage) {
                    lastStage = progress.stage;
                    if (onAddOptimisticMessage && progress.stage) {
                      const updatedFileMessage = {
                        id: fileMessageId, // Same ID to trigger update
                        status:
                          progress.stage === 'uploading'   ? 'uploading' :
                          progress.stage === 'processing'  ? 'processing' :
                          progress.stage === 'completed'   ? 'processed' : 'processing'
                      };
                      onAddOptimisticMessage(updatedFileMessage);
                    }
                  }
                }
              );
              console.log('🎯 Service call completed, result:', result);
              
              console.log('🎉 processFile completed successfully:', {
                success: result.success,
                fileId: result.fileId,
                hasDescription: !!result.description
              });
            } catch (serviceError) {
              console.error('💥 processFile threw an error:', serviceError);
              throw serviceError; // Re-throw to maintain existing error handling
            }
            
            if (!result.success) {
              throw new Error(result.error || 'File processing failed');
            }
            
            console.log(`✅ File processed successfully: ${result.fileId}, chunks: ${result.chunksCreated || 'N/A'}`);
            
            // Update file message to show processed state
            if (onAddOptimisticMessage) {
              const processedMessage = {
                id: fileMessageId, // Same ID to trigger update
                status: 'processed',
                content: file.name // Reset to original filename
              };
              onAddOptimisticMessage(processedMessage);
            }
            
            // 🔧 CRITICAL: Check if we have chunks to trigger auto-analysis
            console.log('🔍 [Composer] Checking auto-analysis conditions:', {
              hasFileId: !!result.fileId,
              hasSessionId: !!confirmedSessionId,
              chunksCreated: result.chunksCreated,
              textLength: textToSend.trim().length,
              fileType: file.type,
              isImage: file.type.startsWith('image/')
            });
            
            // 💾 SAVE USER MESSAGE: Now save the user's message with file attachment to database
            console.log('💾 Saving user message with file attachment to database...');
            try {
              // If we have text, save it and update the existing text message
              if (textToSend.trim() && textMessageId) {
                const userMessageData = {
                  session_id: confirmedSessionId,
                  user_id: user.id,
                  role: 'user',
                  content: textToSend.trim(),
                  action_type: 'file_upload',
                  metadata: {
                    fileId: result.fileId,
                    filename: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    hasAttachment: true
                  },
                  created_at: new Date().toISOString(),
                  message_timestamp: new Date().toISOString(),
                  client_id: textMessageId // Use the existing text message ID
                };

                const { data: savedMessage, error: saveError } = await supabase
                  .from('conversation_messages')
                  .insert(userMessageData)
                  .select()
                  .single();

                if (saveError) {
                  console.error('❌ Failed to save user message:', saveError);
                } else {
                  console.log('✅ User message saved to database:', savedMessage.id);
                  
                  // Update the existing text message to include file info (upsert)
                  if (onAddOptimisticMessage) {
                    const updatedTextMessage = {
                      id: textMessageId, // Keep the same ID to trigger upsert
                      content: textToSend.trim(),
                      role: 'user',
                      session_id: confirmedSessionId,
                      created_at: savedMessage.created_at,
                      type: 'text_with_file',
                      filename: file.name,
                      fileUrl: file.uri,
                      fileSize: file.size,
                      fileType: file.type,
                      status: 'sent',
                      metadata: {
                        fileId: result.fileId,
                        hasAttachment: true,
                        attachmentInfo: {
                          filename: file.name,
                          fileUrl: file.uri,
                          fileSize: file.size,
                          fileType: file.type,
                          fileId: result.fileId,
                          status: 'sent'
                        }
                      }
                    };
                    onAddOptimisticMessage(updatedTextMessage);
                  }
                }
              }
            } catch (dbError) {
              console.error('❌ Database save error:', dbError);
            }
            
            // 🤖 AUTO-ANALYZE: ALWAYS analyze files that have chunks created
            const hasValidChunks = result.chunksCreated && result.chunksCreated > 0;
            const shouldAutoAnalyze = hasValidChunks && result.fileId && confirmedSessionId;
            
            console.log('🔍 [Composer] Auto-analysis decision:', {
              hasValidChunks,
              shouldAutoAnalyze,
              fileId: result.fileId,
              sessionId: confirmedSessionId,
              chunksCreated: result.chunksCreated
            });
            
            if (shouldAutoAnalyze) {
              console.log('🚀 [Composer] AUTO-ANALYSIS TRIGGERED! Starting query-file function...');
              
              // Create streaming assistant message that will trigger thinking indicator
              const assistantId = `assistant-${Date.now()}`;
              const streamingAssistantMessage = {
                id: assistantId,
                content: '',
                role: 'assistant',
                session_id: confirmedSessionId,
                created_at: new Date().toISOString(),
                type: 'text',
                isStreaming: true
              };
              onAddOptimisticMessage(streamingAssistantMessage);
              
              try {
                // Use appropriate question for auto-analysis
                const analysisQuestion = textToSend.trim() || 
                  (file.type.startsWith('image/') ? 
                    'Please analyze this image and describe what you see, including any text content.' :
                    'Please analyze this file and summarize its contents.');
                
                console.log('🔍 [Composer] Calling query-file function with:', {
                  question: analysisQuestion.substring(0, 50) + '...',
                  fileId: result.fileId,
                  sessionId: confirmedSessionId
                });
                
                console.log('🌐 [Composer] About to call supabaseFileService.callQueryFileFunction...');
                
                const queryResult = await supabaseFileService.callQueryFileFunction({
                  question: analysisQuestion,
                  fileId: result.fileId,
                  sessionId: confirmedSessionId
                });
                
                console.log('🎉 [Composer] Query-file function completed!', {
                  success: !!queryResult,
                  hasAnswer: !!queryResult?.answer,
                  sourceCount: queryResult?.sources?.length || 0,
                  userMessageId: queryResult?.userMessageId,
                  assistantMessageId: queryResult?.assistantMessageId
                });
                
                // Replace the streaming message with the real assistant response
                if (queryResult?.assistantMessageId && queryResult?.answer) {
                  const assistantMessage = {
                    id: assistantId, // Use the same ID to trigger upsert
                    content: queryResult.answer,
                    role: 'assistant',
                    session_id: confirmedSessionId,
                    created_at: new Date().toISOString(),
                    type: 'text',
                    isStreaming: false
                  };
                  onAddOptimisticMessage(assistantMessage);
                  console.log('✅ [Composer] Assistant response replaced streaming message - no refresh needed!');
                }
                
                // Trigger callback to notify completion (but no session reload)
                if (onAutoAnalysisComplete) {
                  onAutoAnalysisComplete(confirmedSessionId);
                }
                
              } catch (queryError: any) {
                console.error('💥 [Composer] Auto-analysis failed with error:', queryError);
                console.error('💥 [Composer] Error details:', {
                  message: queryError?.message,
                  stack: queryError?.stack,
                  name: queryError?.name
                });
                
                // Replace streaming message with error message
                const errorMessage = {
                  id: assistantId, // Use the same ID to trigger upsert
                  content: 'I was unable to analyze this file automatically. You can still ask me questions about it manually.',
                  role: 'assistant',
                  session_id: confirmedSessionId,
                  created_at: new Date().toISOString(),
                  type: 'text',
                  isStreaming: false
                };
                onAddOptimisticMessage(errorMessage);
                console.log('✅ [Composer] Error message replaced streaming message');
                
                // Don't show alert - we've added error message to chat
                // Alert.alert('Analysis Failed', 'File uploaded successfully, but auto-analysis failed. You can ask questions about the file manually.');
              }
            } else {
              console.log('❌ [Composer] Auto-analysis SKIPPED because conditions not met');
            }
            
          } catch (error) {
            console.error('💥 [Composer] Supabase file processing error:', error);
            
            // Provide specific error messaging based on error type
            let errorMessage = 'Failed to process file. Please try again.';
            if (error instanceof Error) {
              if (error.message.includes('uuid')) {
                errorMessage = 'Database error: Invalid ID format. Please try again.';
              } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
              }
              console.error('💥 [Composer] Detailed error:', error.message);
            }
            
            Alert.alert('Processing Failed', errorMessage);
            
            // 🔧 CRITICAL: Clear optimistic messages on failure to prevent state corruption
            console.log('🧹 [Composer] Failed optimistic messages will be cleared by parent state management');
          } finally {
            // Always clear file processing state
            setFileProcessingState?.(false);
          }
        };
        
        // Execute the file flow with the confirmed session ID
        console.log('✅ [Composer] Executing file flow with confirmed session:', targetSessionId);
        await executeFileFlow(targetSessionId);
        
        setMessage('');
        setLocalLiveTranscription('');
        Keyboard.dismiss();
        return;
      }

      // ChatGPT-style file upload: If only RAG document and no text, use sendFileMessage
      if (ragDocuments.length === 1 && !textToSend.trim() && imageAttachments.length === 0 && otherFiles.length === 0 && onSendFile && user?.id) {
        const ragFile = ragDocuments[0];
        try {
          // Convert to the format expected by sendFileMessage
          const fileForUpload = {
            name: ragFile.name,
            mimeType: ragFile.type,
            size: ragFile.size,
            uri: ragFile.uri,
            type: ragFile.type
          };
          
          // Clear attachments immediately
          setAttachedFiles([]);
          
          // Use the ChatGPT-style file upload
          await onSendFile(fileForUpload);
          
        } catch (error) {
          console.error('File upload error:', error);
          // Use custom PDF error dialog for text extraction issues
          handlePDFProcessingError(ragFile.name, error);
        }
        
        setMessage('');
        setLocalLiveTranscription('');
        Keyboard.dismiss();
        return;
      }
      
      // Regular message sending with attachments
      onSend(textToSend.trim(), otherFiles.length > 0 ? otherFiles : undefined);
      
      // Process RAG documents after sending (legacy flow)
      if (ragDocuments.length > 0 && user?.id) {
        // Process each RAG document
        for (const ragFile of ragDocuments) {
          try {
            // Update file status to show processing
            setAttachedFiles(prev => 
              prev.map(f => f.id === ragFile.id ? { ...f, isAnalyzing: true, uploadProgress: 0 } : f)
            );

            // Upload and process the document
            await ragFileService.uploadAndProcessDocument(
              {
                name: ragFile.name,
                mimeType: ragFile.type,
                size: ragFile.size,
                uri: ragFile.uri
              } as any,
              user.id,
              (progress) => {
                setAttachedFiles(prev => 
                  prev.map(f => f.id === ragFile.id ? { 
                    ...f, 
                    uploadProgress: progress.progress,
                    isAnalyzing: progress.stage === 'processing' 
                  } : f)
                );
              }
            );

            // Remove processed file from attachments
            setAttachedFiles(prev => prev.filter(f => f.id !== ragFile.id));
            
            // Show success message
            Alert.alert('Document Processed', `${ragFile.name} has been processed and is ready for questions!`);
            
          } catch (error) {
            console.error('RAG document processing error:', error);
            
            // Update file to show error
            setAttachedFiles(prev => 
              prev.map(f => f.id === ragFile.id ? { 
                ...f, 
                error: 'Processing failed',
                isAnalyzing: false,
                uploadProgress: 0
              } : f)
            );
            
            // Use custom PDF error dialog for text extraction issues
            handlePDFProcessingError(ragFile.name, error);
          }
        }
      }
      
      setMessage('');
      setLocalLiveTranscription('');
      // Only clear files that are still processing
      setAttachedFiles(prev => prev.filter(f => (f.isRAGDocument || f.isImageAttachment) && f.isAnalyzing));
      Keyboard.dismiss();
    }
  };

  // Voice recording disabled for now
  const handleVoiceRecording = () => {
    if (disabled) return;
    
    Alert.alert(
      'Voice Recording', 
      'Voice recording feature will be available in the next update.',
      [{ text: 'OK' }]
    );
  };

  // Camera photo capture
  const handleTakePhoto = async () => {
    if (disabled) return;

    // Save focus state and dismiss keyboard
    const wasFocused = isFocused;
    textInputRef.current?.blur();
    Keyboard.dismiss();
    
    // Small delay to ensure keyboard is dismissed
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleFileSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Camera Error', 'Failed to open camera. Please try again.');
    }
    
    // Restore focus if it was previously focused (small delay to ensure camera is closed)
    if (wasFocused) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 300);
    }
  };

  // Photo library picker
  const handleChoosePhoto = async () => {
    if (disabled) return;

    // Save focus state and dismiss keyboard
    const wasFocused = isFocused;
    textInputRef.current?.blur();
    Keyboard.dismiss();
    
    // Small delay to ensure keyboard is dismissed
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Photo library permission is needed to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleFileSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Photo picker error:', error);
      Alert.alert('Photo Error', 'Failed to open photo library. Please try again.');
    }
    
    // Restore focus if it was previously focused
    if (wasFocused) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 300);
    }
  };

  // Document picker - prioritize RAG-compatible files
  const handleChooseFile = async () => {
    if (disabled) return;

    // Save focus state and dismiss keyboard properly
    const wasFocused = isFocused;
    textInputRef.current?.blur();
    Keyboard.dismiss();
    
    // Longer delay for file picker to ensure proper keyboard dismissal
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 
          'text/plain', 
          'text/csv',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets[0]) {
        await handleFileSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('File Error', 'Failed to select file. Please try again.');
    }
    
    // Restore focus with longer delay for file picker
    if (wasFocused) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 500);
    }
  };

  // Handle selected file (from camera, photos, or documents)
  const handleFileSelected = async (file: any) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to upload files.');
      return;
    }

    // Generate a proper filename if one doesn't exist (common for camera/photo library)
    const generateFileName = (file: any): string => {
      if (file.name) return file.name;
      
      const type = file.mimeType || file.type || '';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      if (type.startsWith('image/')) {
        const ext = type.split('/')[1] || 'jpg';
        return `Image_${timestamp}.${ext}`;
      }
      
      return `File_${timestamp}`;
    };

    const fileName = generateFileName(file);

    // Check if it's a supported file type
    const fileType = file.mimeType || file.type || '';
    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf';
    const isDocument = fileType.includes('document') || fileType.includes('text');
    
    // Basic size validation (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size && file.size > maxSize) {
      Alert.alert('File Too Large', 'File size must be less than 10MB.');
      return;
    }
    
    // Supported file types for the new Supabase processing system
    const supportedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!supportedTypes.includes(fileType)) {
      Alert.alert('Unsupported File', 'Please use images, PDFs, or text documents.');
      return;
    }

    // ALL FILES now follow the "attach first, process later" pattern
    // This works with the new Supabase file processing system
    const tempFile: AnalyzedFile = {
      id: `temp_${Date.now()}`,
      name: fileName,
      type: file.mimeType || file.type || 'application/octet-stream',
      size: file.size || 0,
      uri: file.uri,
      uploadProgress: 100, // Mark as ready to send
      isAnalyzing: false,
      isRAGDocument: isPDF || isDocument, // True for PDFs/docs
      isImageAttachment: isImage, // Flag for images
      needsProcessing: true, // Flag that this needs Supabase processing
    };

    // Add to attachments - ready to send (no immediate processing)
    setAttachedFiles(prev => [...prev, tempFile]);
    return;
  };

  // Remove file attachment
  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.semanticColors.border, theme.semanticColors.primary],
  });

  return (
    <View style={styles.container}>
      {/* File Attachments Preview */}
      {attachedFiles.length > 0 && (
        <ScrollView 
          horizontal 
          style={styles.attachmentsContainer}
          showsHorizontalScrollIndicator={false}
        >
          {attachedFiles.map((file) => (
            <View key={file.id} style={styles.attachmentWrapper}>
              <FilePreview
                file={file}
                onRemove={() => handleRemoveFile(file.id)}
                compact
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Text Input Area */}
      <Pressable onPress={handleInputAreaPress}>
        <Animated.View
          style={[
            styles.textContainer,
            {
              backgroundColor: theme.getComposerBackgroundColor(),
              borderColor,
              shadowColor: theme.semanticColors.shadow,
            },
          ]}
        >
          <TextInput
            ref={textInputRef}
            style={[
              styles.textInput,
              {
                color: isCurrentlyRecording ? '#007AFF' : theme.semanticColors.textPrimary,
                paddingRight: 45, // Space for send button
              },
            ]}
            value={displayText}
            onChangeText={liveTranscription || localLiveTranscription ? undefined : setMessage}
            placeholder={placeholder}
            placeholderTextColor={theme.semanticColors.textSecondary}
            multiline
            maxLength={500}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!disabled && !liveTranscription && !localLiveTranscription}
          />
          
          {/* Send Button */}
          {(displayText.trim().length > 0 || attachedFiles.length > 0) && (
            <TouchableOpacity
              style={[
                styles.sendButtonFixed,
                {
                  backgroundColor: theme.semanticColors.primary,
                },
              ]}
              onPress={handleSend}
              disabled={disabled}
            >
              <View style={styles.sendIcon} />
            </TouchableOpacity>
          )}

          {/* Live Transcription Indicator */}
          {(liveTranscription || localLiveTranscription) && (
            <View style={styles.transcriptionIndicator}>
              <Text style={styles.transcriptionLabel}>🎙️ Live</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>

      {/* Action Buttons Area */}
      <View style={styles.actionsContainer}>
        {/* File Attach Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.semanticColors.surface,
              borderColor: theme.semanticColors.border,
            },
          ]}
          onPress={() => setShowAttachmentMenu(true)}
          disabled={disabled}
        >
          <Ionicons 
            name="attach-outline" 
            size={20} 
            color={theme.semanticColors.textPrimary} 
          />
        </TouchableOpacity>

        {/* Voice Recording Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: isCurrentlyRecording ? '#FF3B30' : theme.semanticColors.surface,
              borderColor: isCurrentlyRecording ? '#FF3B30' : theme.semanticColors.border,
            },
          ]}
          onPress={handleVoiceRecording}
          disabled={disabled}
        >
          <Ionicons 
            name={isCurrentlyRecording ? "stop" : "mic-outline"} 
            size={20} 
            color={isCurrentlyRecording ? '#fff' : theme.semanticColors.textPrimary} 
          />
        </TouchableOpacity>
      </View>

      {/* Attachment Menu */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onTakePhoto={handleTakePhoto}
        onChoosePhoto={handleChoosePhoto}
        onChooseFile={handleChooseFile}
      />

      {/* PDF Processing Error Dialog */}
      <PDFProcessingErrorDialog
        visible={showPDFErrorDialog}
        fileName={failedFileName}
        onClose={() => setShowPDFErrorDialog(false)}
        onTryPasting={handleTryPasting}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachmentsContainer: {
    marginBottom: 12,
    maxHeight: 120,
  },
  attachmentWrapper: {
    marginRight: 8,
    width: 200,
  },
  textContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    minHeight: 80,
    maxHeight: 120,
    position: 'relative',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButtonFixed: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: '#FFFFFF',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transcriptionIndicator: {
    position: 'absolute',
    top: 8,
    right: 50,
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  transcriptionLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
}); 