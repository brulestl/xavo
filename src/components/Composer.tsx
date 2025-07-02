import React, { useState, useRef, useEffect } from 'react';
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
import { voiceTranscriptionService, VoiceRecordingProgress } from '../services/voiceTranscriptionService';

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
  onAttachedFilesChange?: (files: AnalyzedFile[]) => void;
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
  onAttachedFilesChange,
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
  
  // Voice recording state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const focusAnim = useRef(new Animated.Value(0)).current;
  const textInputRef = useRef<TextInput>(null);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // Use live transcription if provided, otherwise use message state
  const displayText = liveTranscription || localLiveTranscription || message;
  const isCurrentlyRecording = isRecording || isVoiceRecording;

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

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
    if (textInputRef.current && !disabled && !liveTranscription && !localLiveTranscription && !isVoiceRecording) {
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

  // Voice recording functionality
  const handleVoiceRecording = async () => {
    if (disabled) return;

    if (!voiceTranscriptionService.isAvailable()) {
      Alert.alert(
        'Voice Recording Unavailable',
        'Voice transcription requires an OpenAI API key to be configured.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isVoiceRecording) {
      // Stop recording
      await stopVoiceRecording();
    } else {
      // Start recording
      await startVoiceRecording();
    }
  };

  const startVoiceRecording = async () => {
    try {
      console.log('🎙️ Starting voice recording...');
      
      // Initialize and start recording
      const started = await voiceTranscriptionService.startRecording();
      if (!started) {
        Alert.alert(
          'Recording Failed',
          'Could not start voice recording. Please check your microphone permissions.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsVoiceRecording(true);
      setRecordingDuration(0);
      setLocalLiveTranscription('');

      // Start timer to track recording duration
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      console.log('✅ Voice recording started successfully');
    } catch (error) {
      console.error('❌ Failed to start voice recording:', error);
      Alert.alert(
        'Recording Error',
        'An error occurred while starting the recording. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const stopVoiceRecording = async () => {
    try {
      console.log('🛑 Stopping voice recording...');
      
      // Clear timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      // Stop recording and get URI
      const audioUri = await voiceTranscriptionService.stopRecording();
      setIsVoiceRecording(false);

      if (!audioUri) {
        Alert.alert(
          'Recording Failed',
          'No audio was recorded. Please try again.',
          [{ text: 'OK' }]
        );
        setRecordingDuration(0);
        return;
      }

      console.log('✅ Voice recording stopped, starting transcription...');
      
      // Show transcribing state
      setIsTranscribing(true);
      
      // Transcribe audio
      const transcriptionResult = await voiceTranscriptionService.transcribeAudio(audioUri);
      
      setIsTranscribing(false);
      setRecordingDuration(0);

      if (transcriptionResult.success && transcriptionResult.text) {
        console.log('✅ Transcription successful:', transcriptionResult.text);
        
        // Append transcribed text to existing message (continuation)
        const transcribedText = transcriptionResult.text;
        const currentText = message.trim();
        const newText = currentText ? `${currentText} ${transcribedText}` : transcribedText;
        setMessage(newText);
        
        // Clear live transcription state so it becomes regular message text
        setLocalLiveTranscription('');
        
        // Focus the text input so user can see the result and edit if needed
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      } else {
        console.error('❌ Transcription failed:', transcriptionResult.error);
        Alert.alert(
          'Transcription Failed',
          transcriptionResult.error || 'Could not transcribe the audio. Please try typing your message instead.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error stopping voice recording:', error);
      setIsVoiceRecording(false);
      setIsTranscribing(false);
      setRecordingDuration(0);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      Alert.alert(
        'Recording Error',
        'An error occurred while processing the recording. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Cancel voice recording
  const cancelVoiceRecording = async () => {
    try {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      await voiceTranscriptionService.cancelRecording();
      setIsVoiceRecording(false);
      setIsTranscribing(false);
      setRecordingDuration(0);
      setLocalLiveTranscription('');
      
      console.log('✅ Voice recording canceled');
    } catch (error) {
      console.error('❌ Error canceling voice recording:', error);
    }
  };

  // Format recording duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      
      // 🔥 ENHANCED: Document flow now matches image flow - session creation first!
      // 🆕 UNIFIED SUPABASE FILE FLOW: Handle ALL files (documents, images) with session creation first
      const allFiles = [...ragDocuments, ...imageAttachments];
      console.log('🔍 [Composer] ENHANCED DOCUMENT FLOW conditions:', {
        allFilesLength: allFiles.length,
        hasOnAddOptimisticMessage: !!onAddOptimisticMessage,
        hasUserId: !!user?.id,
        hasSessionId: !!sessionId,
        sessionId,
        userId: user?.id?.substring(0, 10) + '...'
      });
      
      if (allFiles.length === 1 && onAddOptimisticMessage && user?.id) {
        console.log('✅ [Composer] Entering ENHANCED SUPABASE FILE FLOW (documents + images with session handling)');
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
            const fileTypeLabel = file.isRAGDocument ? 'Document' : 'Image';
            const newSession = await onCreateSession(`${fileTypeLabel}: ${file.name}`);
            
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
        
        // 🔧 ENHANCED: Execute file flow with confirmed session ID
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
            
            // UNIFIED APPROACH: Single message with text + file metadata
            const unifiedMessage = {
              id: textToSend.trim() ? textMessageId : fileMessageId,
              content: textToSend.trim() || `Uploading ${file.name}...`,
              role: 'user',
              session_id: confirmedSessionId,
              created_at: new Date().toISOString(),
              type: textToSend.trim() ? 'text_with_file' : 'file',
              filename: file.name,
              fileUrl: file.uri,
              fileSize: file.size,
              fileType: file.type,
              status: 'uploading',
              metadata: {
                hasAttachment: true,
                file_url: file.uri, // For thumbnail generation
                fileType: file.type, // For thumbnail generation
                processingStatus: 'uploading'
              }
            };
            onAddOptimisticMessage(unifiedMessage);
            
            // Clear attachments immediately 
            setAttachedFiles([]);
            
            // Notify parent component that files were cleared
            if (onAttachedFilesChange) {
              onAttachedFilesChange([]);
            }
            
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
                      const updatedUnifiedMessage = {
                        id: textToSend.trim() ? textMessageId : fileMessageId, // Same ID to trigger upsert
                        status: 
                          progress.stage === 'uploading'   ? 'uploading' :
                          progress.stage === 'processing'  ? 'processing' :
                          progress.stage === 'completed'   ? 'processed' : 'processing',
                        metadata: {
                          hasAttachment: true,
                          file_url: file.uri,
                          fileType: file.type,
                          processingStatus: progress.stage
                        }
                      };
                      onAddOptimisticMessage(updatedUnifiedMessage);
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
            
            // Update unified message to show processed state with real file URL
            if (onAddOptimisticMessage) {
              const processedMessage = {
                id: textToSend.trim() ? textMessageId : fileMessageId, // Same ID to trigger upsert
                status: 'processed',
                content: textToSend.trim() || `Document processed: ${file.name}`,
                fileUrl: file.uri, // Use original file URI for now
                metadata: {
                  hasAttachment: true,
                  file_url: file.uri, // For thumbnail generation
                  fileType: file.type,
                  processingStatus: 'completed',
                  fileId: result.fileId
                }
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
              isImage: file.type.startsWith('image/'),
              isDocument: file.isRAGDocument
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
                  fileUrl: file.uri, // ADDED: Include public URL in metadata
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
                
                  // Update the unified message with database ID and final metadata
                if (onAddOptimisticMessage) {
                    const finalUnifiedMessage = {
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
                        hasAttachment: true,
                        file_url: file.uri, // For thumbnail generation
                        fileType: file.type, // For thumbnail generation
                        processingStatus: 'completed',
                        fileId: result.fileId,
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
                    onAddOptimisticMessage(finalUnifiedMessage);
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
              chunksCreated: result.chunksCreated,
              isDocument: file.isRAGDocument,
              isImage: file.type.startsWith('image/')
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
                // Use appropriate question for auto-analysis - enhanced for documents
                let analysisQuestion: string;
                if (file.isRAGDocument) {
                  analysisQuestion = textToSend.trim() || 
                    'Please analyze this document and provide a comprehensive summary of its contents, key points, and main themes.';
                } else {
                  analysisQuestion = textToSend.trim() || 
                    'Please analyze this image and describe what you see, including any text content.';
                }
                
                console.log('🔍 [Composer] Calling query-file function with:', {
                  question: analysisQuestion.substring(0, 50) + '...',
                  fileId: result.fileId,
                  sessionId: confirmedSessionId,
                  fileType: file.type,
                  isDocument: file.isRAGDocument
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
                
                // Replace streaming message with actual response
                if (queryResult && queryResult.answer) {
                  const completedAssistantMessage = {
                    id: assistantId, // Use the same ID to trigger upsert
                    content: queryResult.answer,
                    role: 'assistant',
                    session_id: confirmedSessionId,
                    created_at: new Date().toISOString(),
                    type: 'text',
                    isStreaming: false
                  };
                  onAddOptimisticMessage(completedAssistantMessage);
                  console.log('✅ [Composer] Auto-analysis completed and response updated');
                
                  // Trigger callback for session refresh
                if (onAutoAnalysisComplete) {
                    console.log('🔄 [Composer] Triggering auto-analysis complete callback');
                    onAutoAnalysisComplete(confirmedSessionId);
                  }
                } else {
                  throw new Error('No response from query-file function');
                }
              } catch (queryError) {
                console.error('💥 [Composer] Auto-analysis failed:', queryError);
                
                // Replace streaming message with error message
                const errorAssistantMessage = {
                  id: assistantId, // Use the same ID to trigger upsert
                  content: 'I processed your file but encountered an issue analyzing it. The file has been uploaded successfully.',
                  role: 'assistant',
                  session_id: confirmedSessionId,
                  created_at: new Date().toISOString(),
                  type: 'text',
                  isStreaming: false
                };
                onAddOptimisticMessage(errorAssistantMessage);
              }
            }
            
          } catch (error) {
            console.error('💥 [Composer] File processing failed:', error);
            // Use custom PDF error dialog for text extraction issues
            handlePDFProcessingError(file.name, error);
          } finally {
            // Always clear file processing state
            setFileProcessingState?.(false);
          }
        };
        
        // Execute the file flow
        await executeFileFlow(targetSessionId);
        
        setMessage('');
        setLocalLiveTranscription('');
        Keyboard.dismiss();
        return;
      }

      // 🔥 OLD RAG FLOW: Unified RAG flow - Combined file + text (for compatibility)
      if (ragDocuments.length === 1 && textToSend.trim() && imageAttachments.length === 0 && otherFiles.length === 0 && onSendCombinedFileAndText && onAddOptimisticMessage && user?.id) {
        const ragFile = ragDocuments[0];
        try {
          // 🔧 CRITICAL FIX: Ensure session exists BEFORE any optimistic messages or processing
          let targetSessionId = sessionId;
          
          if (!targetSessionId) {
          if (!onCreateSession) {
              console.error('💥 [Composer] No onCreateSession prop provided for RAG flow');
            Alert.alert('Error', 'Cannot create new conversation. Missing session handler.');
            return;
          }
          
          try {
              console.log('🆕 [Composer] Creating session BEFORE RAG processing...');
              const newSession = await onCreateSession(`Document: ${ragFile.name}`);
            
            if (!newSession) {
              throw new Error('Failed to create new session');
            }
            
              targetSessionId = newSession.id;
              console.log('✅ [Composer] RAG session created successfully:', targetSessionId);
          } catch (sessionError) {
              console.error('💥 [Composer] RAG session creation failed:', sessionError);
            Alert.alert('Error', 'Failed to create new conversation. Please try again.');
              return;
          }
          }
          
          // 🔧 FIXED: Create SINGLE unified message instead of two separate bubbles
          const unifiedMessageId = `temp-unified-${Date.now()}`;
          
          const unifiedMessage = {
            id: unifiedMessageId,
            content: textToSend.trim(),
            role: 'user',
            session_id: targetSessionId,
            created_at: new Date().toISOString(),
            type: 'text_with_file',
            filename: ragFile.name,
            fileUrl: ragFile.uri,
            fileSize: ragFile.size,
            fileType: ragFile.type,
            status: 'uploading',
            metadata: {
              hasAttachment: true,
              file_url: ragFile.uri, // For thumbnail generation
              fileType: ragFile.type, // For thumbnail generation
              processingStatus: 'uploading'
            }
          };
          
          // Add SINGLE unified bubble to UI
          onAddOptimisticMessage(unifiedMessage);
          
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
          
          // Notify parent component that files were cleared
          if (onAttachedFilesChange) {
            onAttachedFilesChange([]);
          }
          
          // Use the unified file + text flow with unified message ID
          await onSendCombinedFileAndText(fileForUpload, textToSend.trim(), unifiedMessageId, unifiedMessageId);
          
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
          
          // Notify parent component that files were cleared
          if (onAttachedFilesChange) {
            onAttachedFilesChange([]);
          }
          
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
      
      // Clear states
      setMessage('');
      setLocalLiveTranscription('');
      // Only clear files that are still processing
      setAttachedFiles(prev => prev.filter(f => (f.isRAGDocument || f.isImageAttachment) && f.isAnalyzing));
      Keyboard.dismiss();
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
        // Request additional metadata including file size when available
        exif: false, // We don't need EXIF data
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Expo ImagePicker sometimes provides file size in the asset object
        const enhancedAsset = {
          ...asset,
          size: (asset as any).fileSize || (asset as any).size || 0, // Try multiple size properties with type assertion
        };
        await handleFileSelected(enhancedAsset);
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
      
      // Safe startsWith check with null guard
      if (type && type.startsWith('image/')) {
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
    
    // Enhanced file size detection - especially important for images
    let fileSize = file.size || file.fileSize || 0;
    
    // For images with missing size, try to estimate or get actual size
    if (isImage && (fileSize === 0 || fileSize === undefined)) {
      try {
        // Try to get file size from URI using fetch (works for some file URIs)
        if (file.uri && file.uri.startsWith('file://')) {
          // For local files, we can't easily get size without native modules
          // So we'll use a reasonable placeholder for images
          fileSize = 0; // Will be handled in FilePreview component
        } else if (file.uri && (file.uri.startsWith('http://') || file.uri.startsWith('https://'))) {
          // For network files, we could try a HEAD request, but for now use 0
          fileSize = 0;
        }
      } catch (error) {
        console.log('Could not determine file size, using 0');
        fileSize = 0;
      }
    }
    
    // Basic size validation (10MB limit) - only if we have a valid size
    const maxSize = 10 * 1024 * 1024;
    if (fileSize > 0 && fileSize > maxSize) {
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
      size: fileSize,
      uri: file.uri,
      uploadProgress: 100, // Mark as ready to send
      isAnalyzing: false,
      isRAGDocument: isPDF || isDocument, // True for PDFs/docs
      isImageAttachment: isImage, // Flag for images
      needsProcessing: true, // Flag that this needs Supabase processing
    };

    // Add to attachments - ready to send (no immediate processing)
    const newFiles = [...attachedFiles, tempFile];
    setAttachedFiles(newFiles);
    
    // Notify parent component about the file changes
    if (onAttachedFilesChange) {
      onAttachedFilesChange(newFiles);
    }
    
    return;
  };

  // Remove file attachment
  const handleRemoveFile = (fileId: string) => {
    const newFiles = attachedFiles.filter(f => f.id !== fileId);
    setAttachedFiles(newFiles);
    
    // Notify parent component about the file changes
    if (onAttachedFilesChange) {
      onAttachedFilesChange(newFiles);
    }
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
            editable={!disabled && !liveTranscription && !isVoiceRecording && !isTranscribing}
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


        </Animated.View>
      </Pressable>

      {/* Voice Recording Overlay */}
      {(isVoiceRecording || isTranscribing) && (
        <View style={styles.recordingOverlay}>
          <View style={styles.recordingContainer}>
            {isTranscribing ? (
              <>
                <View style={styles.transcribingIndicator}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#007AFF" />
                  <Text style={styles.transcribingText}>Transcribing...</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording</Text>
                  <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)}</Text>
                </View>
                <View style={styles.recordingControls}>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={cancelVoiceRecording}
                  >
                    <Ionicons name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.stopButton} 
                    onPress={stopVoiceRecording}
                  >
                    <Ionicons name="checkmark" size={20} color="#34C759" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Action Buttons Area */}
      {!isVoiceRecording && !isTranscribing && (
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
                backgroundColor: theme.semanticColors.surface,
                borderColor: theme.semanticColors.border,
              },
            ]}
            onPress={handleVoiceRecording}
            disabled={disabled}
          >
            <Ionicons 
              name="mic-outline" 
              size={20} 
              color={theme.semanticColors.textPrimary} 
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Attachment Menu */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
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
  recordingOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  recordingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginRight: 8,
  },
  recordingDuration: {
    fontSize: 16,
    fontWeight: '400',
    color: '#666',
  },
  recordingControls: {
    flexDirection: 'row',
    gap: 24,
  },
  cancelButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stopButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transcribingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 8,
  },
}); 