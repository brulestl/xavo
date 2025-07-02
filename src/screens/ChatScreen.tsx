import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  AppState,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { Composer } from '../components/Composer';
import { ChatBubble } from '../components/ChatBubble';
import { TypingDots } from '../components/TypingDots';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { AnalyzedFile } from '../services/fileAnalysisService';
import { getIntent } from '../utils/intentUtils';
import { api } from '../lib/api';
import { ChatMessage } from '../hooks/useChat';

import { Drawer } from '../components/Drawer';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { SharkToggleIcon } from '../components/SharkToggleIcon';
import { supabaseFileService } from '../services/supabaseFileService';


type ChatScreenNavigationProp = DrawerNavigationProp<any>;



interface RouteParams {
  sessionId?: string;
  initialMessage?: string;
  initialAttachments?: any[];
  textMessageId?: string;
  fileMessageId?: string;
  isProcessingFile?: boolean;
}

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { user, tier, canMakeQuery } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isSettingsDrawerVisible, setIsSettingsDrawerVisible] = useState(false);
  const [hasProcessedInitialMessage, setHasProcessedInitialMessage] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  
  // Rename modal state
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  // Delete confirmation modal state
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState<any>(null);
  
  const {
    messages,
    sessions,
    currentSession,
    isLoading,
    isStreaming,
    isThinking,
    isSending,
    isProcessingFile,
    error,
    sendMessage,
    sendFileMessage,
    sendCombinedFileAndTextMessage,
    createSession,
    loadSession,
    deleteSession,
    renameSession,
    clearMessages,
    setCurrentSession,
    queryFile, // ADDED: Include queryFile function
    appendMessage,
    updateMessage,
    removeMessage,
    setFileProcessingState,
  } = useChat();

  // 🔥 Use instant operations from useConversations for rename functionality
  const { 
    conversations, 
    loading: conversationsLoading, 
    renameConversationInstant, 
    triggerRefreshAfterMessage,
    updateMessage: updateConversationMessage,
    deleteConversationInstant
  } = useConversations();

  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: false });
    }
  }, [messages]);

  // 🔧 FIX 2: Auto-scroll to latest message when switching conversations
  useEffect(() => {
    if (currentSession?.id && messages.length > 0 && flatListRef.current) {
      console.log('🔄 [ChatScreen] Conversation switched - auto-scrolling to latest message');
      // Use a small delay to ensure FlatList has rendered the new messages
      const scrollTimer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
      
      return () => clearTimeout(scrollTimer);
    }
  }, [currentSession?.id]); // Trigger when conversation ID changes

  // 🔥 FIX: Handle app state changes to prevent layout displacement from external UIs
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // When app becomes active after file picker, ensure keyboard is properly dismissed
        Keyboard.dismiss();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  // @ts-ignore - navigation params
  const routeParams = route.params as RouteParams;
  const sessionId = routeParams?.sessionId;
  const initialMessage = routeParams?.initialMessage;
  const initialAttachments = routeParams?.initialAttachments;
  const textMessageId = routeParams?.textMessageId;
  const fileMessageId = routeParams?.fileMessageId;
  const isProcessingFileFromRoute = routeParams?.isProcessingFile;

  // Handle session loading and initial message processing
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // 🔧 CRITICAL FIX: Always clear session state when starting new conversation
        if (!sessionId) {
          console.log('🆕 [ChatScreen] Starting new conversation - clearing all state');
          clearMessages(); // This now also clears currentSession
          setIsEditingMessage(false);
        } else {
                  // When switching to a different session, clear previous state
        if (currentSession && currentSession.id !== sessionId) {
          console.log(`🔄 [ChatScreen] Switching from session ${currentSession.id} to ${sessionId} - clearing state`);
          clearMessages();
          setIsEditingMessage(false);
          // 🔧 CRITICAL: Force clear any lingering optimistic messages
          console.log('🧹 [ChatScreen] Force clearing any persistent optimistic messages');
        }
        }
        
        // Reset processed state when route params change
        if (initialMessage || initialAttachments) {
          setHasProcessedInitialMessage(false);
        }
        
        // If we have a sessionId, load that session
        if (sessionId) {
          // 🔧 CRITICAL: Never preserve optimistic messages during conversation switching
          // Only preserve messages during active streaming/sending within the SAME session
          const isSameSession = currentSession?.id === sessionId;
          const preserveMessages = isSameSession && (isStreaming || isSending) && messages.length > 0;
          console.log(`🔄 [ChatScreen] Loading session ${sessionId}, isSameSession: ${isSameSession}, preserveMessages: ${preserveMessages}`);
          await loadSession(sessionId, preserveMessages);
        }
        
        // 🔥 ENHANCED: Handle initial attachments with Enhanced File Flow
        if (initialAttachments && initialAttachments.length > 0 && !hasProcessedInitialMessage && user?.id && sessionId) {
          console.log('🚀 [ChatScreen] Processing initial attachments with Enhanced File Flow');
          setHasProcessedInitialMessage(true);
          setFileProcessingState(true);
          
          try {
            const file = initialAttachments[0];
            
            // Continue the Enhanced File Flow started in HomeScreen
            console.log('🔧 [ChatScreen] Continuing Enhanced File Flow from HomeScreen');
            
            // Start file processing using supabaseFileService
            const result = await supabaseFileService.processFile(
              file.uri,
              file.type,
              file.name,
              sessionId!,
              (progress) => {
                console.log(`📄 File processing: ${progress.stage} - ${progress.message}`);
                
                // Update the optimistic message with progress
                if (textMessageId || fileMessageId) {
                  const messageId = textMessageId || fileMessageId;
                  if (messageId) {
                    const updatedMessage = {
                      id: messageId,
                      status: 
                        progress.stage === 'uploading'   ? 'uploading' as const :
                        progress.stage === 'processing'  ? 'processing' as const :
                        progress.stage === 'completed'   ? 'processed' as const : 'processing' as const,
                      metadata: {
                        hasAttachment: true,
                        file_url: file.uri,
                        fileType: file.type,
                        processingStatus: progress.stage
                      }
                    };
                    updateMessage(messageId, updatedMessage);
                  }
                }
              }
            );
            
            if (result.success) {
              console.log(`✅ File processed successfully: ${result.fileId}`);
              
              // Update the message to show processed state
              if (textMessageId || fileMessageId) {
                const messageId = textMessageId || fileMessageId;
                if (messageId) {
                  const processedMessage = {
                    id: messageId,
                    status: 'processed' as const,
                    metadata: {
                      hasAttachment: true,
                      file_url: file.uri,
                      fileType: file.type,
                      processingStatus: 'completed',
                      fileId: result.fileId
                    }
                  };
                  updateMessage(messageId, processedMessage);
                }
              }
              
              // Auto-analyze if file has chunks
              const hasValidChunks = result.chunksCreated && result.chunksCreated > 0;
              if (hasValidChunks && result.fileId) {
                console.log('🚀 [ChatScreen] Starting auto-analysis...');
                
                try {
                  // Use appropriate question for auto-analysis
                  let analysisQuestion: string;
                  if (file.isRAGDocument) {
                    analysisQuestion = initialMessage || 
                      'Please analyze this document and provide a comprehensive summary of its contents, key points, and main themes.';
                  } else {
                    analysisQuestion = initialMessage || 
                      'Please analyze this image and describe what you see, including any text content.';
                  }
                  
                  const queryResult = await supabaseFileService.callQueryFileFunction({
                    question: analysisQuestion,
                    fileId: result.fileId,
                    sessionId: sessionId!
                  });
                  
                  if (queryResult && queryResult.answer) {
                    console.log('✅ [ChatScreen] Auto-analysis completed');
                    // Reload session to show the new assistant message
                    await loadSession(sessionId!, false);
                  }
                  
                } catch (queryError) {
                  console.error('💥 [ChatScreen] Auto-analysis failed:', queryError);
                }
              }
              
            } else {
              throw new Error(result.error || 'File processing failed');
            }
            
          } catch (error) {
            console.error('❌ [ChatScreen] Enhanced File Flow failed:', error);
            Alert.alert('Error', 'Failed to process file. Please try again.');
          } finally {
            setFileProcessingState(false);
          }
          
          return; // Don't process regular initial message
        }
        
        // If we have an initial message and haven't processed it yet, send it
        if (initialMessage && !hasProcessedInitialMessage) {
          setHasProcessedInitialMessage(true);
          await handleSendMessage(initialMessage);
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
      }
    };

    initializeChat();
  }, [sessionId, initialMessage, initialAttachments]);

  const handleSendMessage = async (message: string, attachments?: AnalyzedFile[]) => {
    if (!canMakeQuery) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Check intent before processing
      const intent = getIntent(message);
      
      // Handle list_files intent
      if (intent.type === 'list_files' && currentSession?.id) {
        console.log('📁 Detected list_files intent, fetching session files...');
        
        // First add the user message
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: message,
          session_id: currentSession.id,
          created_at: new Date().toISOString(),
          type: 'text'
        };
        appendMessage(userMessage);
        
        try {
          // Get session files
          const { files } = await api.getSessionFiles(currentSession.id);
          
          // Build synthetic assistant response
          let assistantContent: string;
          if (!files || files.length === 0) {
            assistantContent = "You haven't uploaded any files yet in this chat.";
          } else {
            const fileList = files.map(file => {
              const status = file.status === 'completed' ? '✅' : '⏳';
              const pages = file.page_count ? `, ${file.page_count} pages` : '';
              const chunks = file.chunk_count ? `, ${file.chunk_count} chunks` : '';
              return `• ${file.filename} (${status}${pages}${chunks})`;
            }).join('\n');
            
            assistantContent = `Here are the files you've uploaded in this chat:\n\n${fileList}`;
          }
          
          // Add synthetic assistant message
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent,
            session_id: currentSession.id,
            created_at: new Date().toISOString(),
            type: 'text'
          };
          appendMessage(assistantMessage);
          
        } catch (error) {
          console.error('Failed to fetch session files:', error);
          const errorMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: "I'm having trouble accessing your file list right now. Please try again later.",
            session_id: currentSession.id,
            created_at: new Date().toISOString(),
            type: 'text'
          };
          appendMessage(errorMessage);
        }
        
        return; // Don't proceed with normal message flow
      }
      
      // Normal message flow for all other intents
      let finalMessage = message;
      
      // If there are attachments, append their analysis to the message
      if (attachments?.length) {
        const attachmentContext = attachments.map(file => {
          if (file.analysis?.aiResponse) {
            return `\n\n📎 **${file.name}** (${file.type}):\n${file.analysis.aiResponse}`;
          } else {
            return `\n\n📎 **${file.name}** (${file.type}): File uploaded but analysis not available.`;
          }
        }).join('');
        
        finalMessage = (message + attachmentContext).trim();
        console.log('📎 ChatScreen: Sending message with', attachments.length, 'attachments');
      }
      
      console.log(`📝 Sending message to session: ${currentSession?.id || 'new session'}`);
      await sendMessage(finalMessage, currentSession?.id, false); // Use non-streaming for better UX
      
      // 🔄 Trigger conversation refresh to update ordering after message sent
      // REMOVED: This was causing conversation jumping after image uploads
      // if (currentSession?.id) {
      //   triggerRefreshAfterMessage(currentSession.id);
      // }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      console.error('Send message error:', error);
    }
  };

  const handleSendCombinedFileAndText = async (file: any, text: string, textMessageId: string, fileMessageId: string) => {
    if (!canMakeQuery) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to upload files.');
      return;
    }

    try {
      console.log(`🔥 Starting unified RAG flow: "${text}" with file "${file.name}"`);
      await sendCombinedFileAndTextMessage(file, text, user.id, currentSession?.id, textMessageId, fileMessageId);
      
      // 🔄 Trigger conversation refresh to update ordering after file message sent
      // REMOVED: This was causing conversation jumping after image uploads 
      // if (currentSession?.id) {
      //   triggerRefreshAfterMessage(currentSession.id);
      // }
    } catch (error) {
      Alert.alert('Error', 'Failed to process file with your question. Please try again.');
      console.error('Combined file + text error:', error);
    }
  };

  const handleAddOptimisticMessage = (message: any) => {
    // Check if this is a removal request
    if (message.type === 'removed') {
      removeMessage(message.id);
      return;
    }
    
    // Check if message already exists (for updates)
    const existingMessage = messages.find(msg => msg.id === message.id);
    
    if (existingMessage) {
      // Merge with existing message to preserve all properties and prevent key conflicts
      const mergedMessage = { ...existingMessage, ...message };
      updateMessage(message.id, mergedMessage);
      console.log(`🔄 [ChatScreen] Updated existing message: ${message.id}`);
    } else {
      // Add new message
      appendMessage(message);
      console.log(`➕ [ChatScreen] Added new message: ${message.id}`);
    }
  };

  // Handle auto-analysis completion to refresh session
  const handleAutoAnalysisComplete = async (sessionId: string) => {
    console.log('🔄 [ChatScreen] Auto-analysis completed for session:', sessionId);
    // NOTE: We don't need to reload the session here because:
    // 1. The query-file function already creates the assistant message in the database
    // 2. Session reloading causes conversation jumping to the top
    // 3. The live message syncing will handle showing new messages
    console.log('✅ [ChatScreen] Auto-analysis complete - relying on live message syncing');
  };

  // Create session helper for Composer
  const handleCreateSession = async (title?: string): Promise<{ id: string; title: string } | null> => {
    try {
      console.log('🆕 [ChatScreen] Creating new session for file upload:', title);
      
      // Use the useChat createSession function directly instead of sending a dummy message
      const newSession = await createSession(title || 'New Conversation');
      
      if (newSession) {
        console.log('✅ [ChatScreen] Session created successfully:', newSession.id);
        return {
          id: newSession.id,
          title: newSession.title
        };
      } else {
        throw new Error('Failed to create session - no session returned');
      }
    } catch (error) {
      console.error('❌ [ChatScreen] Failed to create session:', error);
      
      // Show user-friendly error feedback
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('Authentication') || errorMessage.includes('401')) {
        Alert.alert('Authentication Error', 'Please sign in again to continue.');
      } else {
        Alert.alert('Connection Error', 'Unable to start chat. Please check your connection and try again.');
      }
      
      return null;
    }
  };



  const handleUpload = () => {
    console.log('Upload pressed');
    // TODO: Implement file upload functionality
  };

  const handleVoiceNote = () => {
    if (tier !== 'shark') {
      Alert.alert(
        'Premium Feature',
        'Voice features are available for Shark Strategist tier only.',
        [{ text: 'OK' }]
      );
      return;
    }
    console.log('Voice note pressed');
    // TODO: Implement voice note functionality
  };

  const handleMenuPress = () => {
    setIsDrawerVisible(true);
  };

  const handleNavigateToSubscriptions = () => {
    setIsSettingsDrawerVisible(false);
    // TODO: Navigate to subscriptions
  };

  const handleNavigateToOnboardingEdit = () => {
    setIsSettingsDrawerVisible(false);
    // TODO: Navigate to onboarding edit
  };

  const handleRenamePress = (session: any) => {
    setRenamingSessionId(session.id);
    setRenameInputValue(session.title || '');
    setIsRenameModalVisible(true);
  };

  const handleRenameSubmit = async () => {
    if (!renamingSessionId || !renameInputValue.trim()) {
      Alert.alert('Error', 'Please enter a valid title');
      return;
    }

    try {
      // 🔥 Use instant rename for immediate UI feedback
      await renameConversationInstant(renamingSessionId, renameInputValue.trim());
      
      setIsRenameModalVisible(false);
      setRenamingSessionId(null);
      setRenameInputValue('');
      
      console.log(`✨ Instant rename completed in ChatScreen`);
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      Alert.alert('Error', 'Failed to rename conversation. Please try again.');
    }
  };

  const handleRenameCancel = () => {
    setIsRenameModalVisible(false);
    setRenamingSessionId(null);
    setRenameInputValue('');
  };

  const handleDeletePress = (conversation: any) => {
    console.log('🔥 handleDeletePress called with:', conversation);
    console.log('🔥 Conversation ID:', conversation.id);
    console.log('🔥 Conversation title:', conversation.title);
    
    console.log('🚨 About to show confirmation dialog...');
    setDeletingConversation(conversation);
    setIsDeleteModalVisible(true);
    console.log('🚨 Delete modal should be visible now');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingConversation) return;

    try {
      console.log('🔥 User confirmed deletion, proceeding...');
      console.log('🔥 Calling deleteConversationInstant for:', deletingConversation.id);
      
      // Close modal first
      setIsDeleteModalVisible(false);
      setDeletingConversation(null);
      
      // 🔥 Use instant delete for immediate UI feedback
      await deleteConversationInstant(deletingConversation.id);
      console.log(`✨ Instant delete completed successfully for: ${deletingConversation.id}`);
    } catch (error) {
      console.error('❌ Failed to delete conversation:', error);
      Alert.alert('Error', 'Failed to delete conversation. Please try again.');
    }
  };

  const handleDeleteCancel = () => {
    console.log('❌ User cancelled deletion');
    setIsDeleteModalVisible(false);
    setDeletingConversation(null);
  };

  // Helper function to regenerate AI response without creating new user message
  const regenerateAIResponse = async (messageContent: string, sessionId: string) => {
    try {
      console.log('🤖 [src/ChatScreen] Generating AI response for edited message...');
      
      // Call the chat API directly with a special flag to indicate this is regeneration
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const response = await fetch('https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: messageContent,
          sessionId: sessionId,
          actionType: 'regenerate_response', // Special flag for regeneration
          skipUserMessage: true // Don't create new user message
        }),
      });

      if (!response.ok) {
        throw new Error(`AI response generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ [src/ChatScreen] AI response regenerated successfully');
      
      // Reload session to show the new AI response
      await loadSession(sessionId, false);
      
      return result;
    } catch (error) {
      console.error('❌ [src/ChatScreen] Failed to regenerate AI response:', error);
      throw error;
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    if (!currentSession?.id) {
      throw new Error('No active session');
    }

    // 🔧 FIX: Prevent multiple simultaneous edits
    if (isEditingMessage) {
      console.log('⚠️ [src/ChatScreen] Edit already in progress, ignoring duplicate request');
      return false;
    }

    try {
      // 🔧 FIX: Immediate feedback - set editing state first
      setIsEditingMessage(true);
      console.log(`🔧 [src/ChatScreen] Starting ChatGPT-like edit for message ${messageId}`);
      console.log(`🔍 [src/ChatScreen] Current messages count: ${messages.length}`);
      
      // 1. Get fresh session data directly from API to avoid race conditions
      console.log('🔄 [src/ChatScreen] Fetching fresh session data...');
      const { data } = await supabase
        .from('conversation_sessions')
        .select(`
          *,
          conversation_messages (
            id, role, content, created_at, message_timestamp
          )
        `)
        .eq('id', currentSession.id)
        .eq('user_id', user?.id)
        .single();
        
      if (!data) {
        throw new Error('Session not found');
      }
      
      const freshMessages = data.conversation_messages || [];
      console.log(`📝 [src/ChatScreen] Fresh messages count: ${freshMessages.length}`);
      
      // 2. Find the index of the message being edited  
      const editedMessageIndex = freshMessages.findIndex((msg: any) => msg.id === messageId);
      if (editedMessageIndex === -1) {
        throw new Error(`Message ${messageId} not found in conversation`);
      }
      
      console.log(`🔍 [src/ChatScreen] Found message at index ${editedMessageIndex} of ${freshMessages.length}`);
      
      // 3. Identify messages to remove (all messages after the edited one)
      const messagesToRemove = freshMessages.slice(editedMessageIndex + 1);
      console.log(`🗑️ [src/ChatScreen] Will remove ${messagesToRemove.length} subsequent messages`);
      
      // 4. Remove subsequent messages from database
      if (messagesToRemove.length > 0) {
        console.log('🗑️ [src/ChatScreen] Removing subsequent messages from database...');
        for (const msgToRemove of messagesToRemove) {
          try {
            const { error } = await supabase
              .from('conversation_messages')
              .delete()
              .eq('id', msgToRemove.id)
              .eq('session_id', currentSession.id)
              .eq('user_id', user?.id);
              
            if (error) {
              console.error(`❌ Failed to delete message ${msgToRemove.id}:`, error);
            } else {
              console.log(`✅ Deleted message ${msgToRemove.id}`);
            }
          } catch (delError) {
            console.error(`❌ Error deleting message ${msgToRemove.id}:`, delError);
          }
        }
      }
      
      // 5. Update the edited message content in database
      console.log(`📝 [src/ChatScreen] Updating message content in database...`);
      await updateConversationMessage(currentSession.id, messageId, newContent);
      console.log(`✅ [src/ChatScreen] Message ${messageId} updated successfully in database`);
      
      // 6. Clear and reload to show updated conversation
      console.log('🔄 [src/ChatScreen] Reloading conversation after cleanup...');
      clearMessages();
      await new Promise(resolve => setTimeout(resolve, 50));
      await loadSession(currentSession.id, false);
      
      // 7. Generate new AI response WITHOUT creating duplicate user message
      console.log('🤖 [src/ChatScreen] Regenerating AI response for edited message...');
      await regenerateAIResponse(newContent, currentSession.id);
      
      console.log('✅ [src/ChatScreen] ChatGPT-like edit completed successfully!');
      
      return true;
    } catch (error) {
      console.error('❌ [src/ChatScreen] Failed to edit message:', error);
      throw error;
    } finally {
      // 🔧 FIX: Always reset editing state
      setIsEditingMessage(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    return (
      <ChatBubble
        message={item.content}
        messageId={item.id}
        conversationId={currentSession?.id || ''}
        isUser={item.role === 'user'}
        timestamp={item.timestamp}
        onEditMessage={handleEditMessage}
        isStreaming={item.isStreaming === true}
        type={item.type || 'text'}
        filename={item.filename}
        fileUrl={item.fileUrl}
        fileSize={item.fileSize}
        fileType={item.fileType}
        status={item.status}
        metadata={item.metadata}
        onQueryFile={queryFile} // ADDED: Wire the queryFile function
      />
    );
  };

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.semanticColors.background }]} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.semanticColors.background} />
        
        {/* Header - OUTSIDE KeyboardAvoidingView so it stays fixed */}
        <View style={[styles.header, { paddingTop: 0 }]}>
          {/* Hamburger Menu */}
          <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
            <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
            <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
            <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          </TouchableOpacity>

          {/* Conversation Title */}
          <View style={styles.titleContainer}>
            <Text 
              style={[styles.conversationTitle, { color: theme.semanticColors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {currentSession?.title ? 
                (currentSession.title.length > 20 ? 
                  `${currentSession.title.substring(0, 20)}...` : 
                  currentSession.title
                ) : 
                'New Chat'
              }
            </Text>
          </View>

          {/* Header Right: Shark Toggle + Settings */}
          <View style={{ flexDirection: 'row', gap: 8, marginRight: -8 }}>
            <SharkToggleIcon />
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={() => setIsSettingsDrawerVisible(true)}
            >
              <Ionicons name="settings-outline" size={24} color={theme.semanticColors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content - Wrap in proper container for bottom edge handling */}
        <View style={styles.contentContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.select({ ios: 'padding', android: 'height' })}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 24 })}
            style={{ flex: 1 }}
          >
            {/* Messages List */}
            <View style={{ flex: 1, position: 'relative' }}>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                  // Enhanced auto-scroll: ensure we always see the latest message
                  if (messages.length > 0) {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  }
                }}
                onLayout={() => {
                  // Enhanced auto-scroll: handle layout changes during conversation switching
                  if (messages.length > 0) {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  }
                }}
                ListFooterComponent={
                  (isThinking || isProcessingFile) ? (
                    <ThinkingIndicator visible={true} />
                  ) : isStreaming ? (
                    <TypingDots visible={true} />
                  ) : null
                }
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#666', fontSize: 16 }}>
                      {isLoading ? 'Loading messages...' : 'Start your conversation'}
                    </Text>
                  </View>
                }
              />
              

            </View>

            {/* Error Display */}
            {error && (
              <View style={[styles.errorContainer, { backgroundColor: '#FF6B6B' }]}>
                <Text style={[styles.errorText, { color: '#FFFFFF' }]}>
                  {error || 'Something went wrong'}
                </Text>
              </View>
            )}

            {/* Composer with stable padding */}
            <View 
              style={[
                styles.composerContainer, 
                { 
                  backgroundColor: theme.semanticColors.background,
                  zIndex: isDrawerVisible || isSettingsDrawerVisible ? -1 : 1,
                  opacity: isDrawerVisible || isSettingsDrawerVisible ? 0 : 1,
                  paddingBottom: Math.max(insets.bottom, 16), // Ensure minimum padding, prevent displacement
                }
              ]}
            >
              <Composer
                onSend={handleSendMessage}
                onSendFile={user?.id ? (file) => sendFileMessage(file, user.id, currentSession?.id) : undefined}
                onSendCombinedFileAndText={user?.id ? handleSendCombinedFileAndText : undefined}
                onAddOptimisticMessage={handleAddOptimisticMessage}
                onCreateSession={handleCreateSession}
                placeholder={
                  isSending
                    ? "Sending message..."
                    : isEditingMessage 
                      ? "Saving edit..." 
                      : isProcessingFile
                        ? "Processing file..."
                        : isThinking
                          ? "Xavo is thinking..."
                          : "What's on your mind?"
                }
                disabled={!canMakeQuery || isEditingMessage || isSending || isThinking || isProcessingFile}
                sessionId={currentSession?.id}
                isProcessingFile={isProcessingFile}
                setFileProcessingState={setFileProcessingState}
                onAutoAnalysisComplete={handleAutoAnalysisComplete}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      {/* DRAWERS MOVED OUTSIDE SafeAreaView - ALWAYS STATIC */}
      <Drawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        title="Conversations"
      >
        <View style={styles.drawerContent}>
          {/* NEW CONVERSATION BUTTON */}
          <TouchableOpacity
            style={[styles.newConversationButton, { backgroundColor: theme.semanticColors.surface, borderColor: theme.semanticColors.border }]}
            onPress={() => {
              setIsDrawerVisible(false);
              console.log('🆕 ChatScreen: Starting NEW EMPTY conversation from drawer');
              // Navigate to ChatScreen for empty "Start your conversation" experience
              (navigation as any).navigate('Chat', {});
            }}
          >
            <Ionicons name="add" size={20} color={theme.semanticColors.textPrimary} />
            <Text style={[styles.newConversationText, { color: theme.semanticColors.textPrimary }]}>
              New Conversation
            </Text>
          </TouchableOpacity>
          
          {/* Existing conversation list */}
          {conversationsLoading ? (
            <View style={styles.conversationLoadingContainer}>
              <ActivityIndicator size="large" color={theme.semanticColors.primary} />
              <Text style={[styles.conversationLoadingText, { color: theme.semanticColors.textSecondary }]}>
                Loading conversations...
              </Text>
            </View>
          ) : conversations.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {conversations.map((conversation) => (
                <View
                  key={conversation.id}
                  style={[styles.conversationItem, { borderBottomColor: theme.semanticColors.border }]}
                >
                  <TouchableOpacity
                    style={styles.conversationMain}
                    onPress={() => {
                      setIsDrawerVisible(false);
                      (navigation as any).navigate('Chat', { 
                        sessionId: conversation.id,
                        conversationId: conversation.id
                      });
                    }}
                  >
                    <View style={styles.conversationContent}>
                      <Text style={[styles.conversationTitle, { color: theme.semanticColors.textPrimary }]} numberOfLines={1}>
                        {conversation.title || 'Untitled Conversation'}
                      </Text>
                      <Text style={[styles.conversationDate, { color: theme.semanticColors.textSecondary }]}>
                        {new Date(conversation.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <Ionicons 
                      name="chevron-forward" 
                      size={16} 
                      color={theme.semanticColors.textSecondary} 
                    />
                  </TouchableOpacity>
                  
                  {/* Action buttons */}
                  <View style={styles.conversationActions}>
                    {/* Rename button */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        console.log('🖱️ Rename button pressed for:', conversation.id);
                        handleRenamePress(conversation);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={18} color={theme.semanticColors.textSecondary} />
                    </TouchableOpacity>
                    
                    {/* Delete button */}
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteActionButton]}
                      onPress={() => {
                        console.log('🖱️ DELETE button pressed for:', conversation.id);
                        console.log('🖱️ Conversation title:', conversation.title);
                        handleDeletePress(conversation);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.drawerText, { color: theme.semanticColors.textSecondary }]}>
              Your conversations will appear here after you start chatting.
            </Text>
          )}
        </View>
      </Drawer>

      {/* Settings Drawer - ALWAYS STATIC */}
      <SettingsDrawer
        isVisible={isSettingsDrawerVisible}
        onClose={() => setIsSettingsDrawerVisible(false)}
        onNavigateToSubscriptions={handleNavigateToSubscriptions}
        onNavigateToOnboardingEdit={handleNavigateToOnboardingEdit}
      />

      {/* Rename Modal */}
      <Modal
        visible={isRenameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleRenameCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.semanticColors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.semanticColors.textPrimary }]}>
              Rename Conversation
            </Text>
            
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.semanticColors.background,
                  borderColor: theme.semanticColors.border,
                  color: theme.semanticColors.textPrimary,
                }
              ]}
              value={renameInputValue}
              onChangeText={setRenameInputValue}
              placeholder="Enter conversation title"
              placeholderTextColor={theme.semanticColors.textSecondary}
              autoFocus={true}
              onSubmitEditing={handleRenameSubmit}
              maxLength={100}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.cancelButton,
                  { borderColor: theme.semanticColors.border }
                ]}
                onPress={handleRenameCancel}
              >
                <Text style={[styles.buttonText, { color: theme.semanticColors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { 
                    backgroundColor: theme.semanticColors.primary,
                    opacity: renameInputValue.trim() ? 1 : 0.5
                  }
                ]}
                onPress={handleRenameSubmit}
                disabled={!renameInputValue.trim()}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDeleteCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.semanticColors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.semanticColors.textPrimary }]}>
              Delete Conversation
            </Text>
            
            <Text style={[styles.modalMessage, { color: theme.semanticColors.textSecondary }]}>
              Are you sure you want to delete "{deletingConversation?.title || 'Untitled Conversation'}"?{'\n\n'}This action cannot be undone.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.cancelButton,
                  { borderColor: theme.semanticColors.border }
                ]}
                onPress={handleDeleteCancel}
              >
                <Text style={[styles.buttonText, { color: theme.semanticColors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.deleteButton,
                  { backgroundColor: '#FF6B6B' }
                ]}
                onPress={handleDeleteConfirm}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    zIndex: 100,
  },
  menuButton: {
    padding: 8,
  },
  hamburger: {
    width: 20,
    height: 2,
    marginVertical: 2,
    borderRadius: 1,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  settingsButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 0,
  },

  errorContainer: {
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8, // Add some top padding for visual separation
  },
  drawerContent: {
    paddingVertical: 20,
  },
  drawerText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  newConversationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  newConversationText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  emptyState: {
    paddingVertical: 20,
  },
  sessionsList: {
    marginTop: 10,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionMeta: {
    fontSize: 14,
    marginBottom: 2,
  },
  sessionLastActivity: {
    fontSize: 12,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  renameButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  deleteActionButton: {
    // Additional styles for delete button if needed
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 🔥 NEW: HomeScreen-matching conversation styles
  conversationLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  conversationLoadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  conversationMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationDate: {
    fontSize: 12,
  },
  conversationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    marginLeft: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 