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

import { Drawer } from '../components/Drawer';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';


type ChatScreenNavigationProp = DrawerNavigationProp<any>;



interface RouteParams {
  sessionId?: string;
  initialMessage?: string;
}

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute();
  const { sessionId, initialMessage } = (route.params as RouteParams) || {};
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
  
  const {
    messages,
    sessions,
    currentSession,
    isLoading,
    isStreaming,
    isThinking,
    isSending,
    error,
    sendMessage,
    sendFileMessage,
    sendCombinedFileAndTextMessage,
    loadSession,
    deleteSession,
    renameSession,
    clearMessages,
    setCurrentSession,
    appendMessage,
  } = useChat();

  // 🔥 Use instant operations from useConversations for rename functionality
  const { renameConversationInstant, updateMessage } = useConversations();

  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Handle session loading and initial message processing
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // 🔧 CRITICAL FIX: Always clear session state when starting new conversation
        if (!sessionId) {
          console.log('🆕 [ChatScreen] Starting new conversation - clearing all state');
          clearMessages(); // This now also clears currentSession
          setIsEditingMessage(false);
        }
        
        // Reset processed state when route params change
        if (initialMessage) {
          setHasProcessedInitialMessage(false);
        }
        
        // If we have a sessionId, load that session
        if (sessionId) {
          // Preserve current messages if we already have some (e.g., during streaming)
          const preserveMessages = messages.length > 0;
          await loadSession(sessionId, preserveMessages);
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
  }, [sessionId, initialMessage]);

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
    } catch (error) {
      Alert.alert('Error', 'Failed to process file with your question. Please try again.');
      console.error('Combined file + text error:', error);
    }
  };

  const handleAddOptimisticMessage = (message: any) => {
    // Use the appendMessage helper from useChat
    appendMessage(message);
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
      await updateMessage(currentSession.id, messageId, newContent);
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
        isStreaming={isStreaming && item.role === 'assistant'}
        type={item.type || 'text'}
        filename={item.filename}
        fileUrl={item.fileUrl}
        fileSize={item.fileSize}
        fileType={item.fileType}
        status={item.status}
        metadata={item.metadata}
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

          {/* Settings Button */}
          <TouchableOpacity 
            style={styles.settingsButton} 
            onPress={() => setIsSettingsDrawerVisible(true)}
          >
            <Ionicons name="settings-outline" size={24} color={theme.semanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={styles.keyboardContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isThinking ? (
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



          {/* Error Display */}
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: '#FF6B6B' }]}>
              <Text style={[styles.errorText, { color: '#FFFFFF' }]}>
                {error || 'Something went wrong'}
              </Text>
            </View>
          )}

          {/* Composer with proper keyboard handling */}
          <View 
            style={[
              styles.composerContainer, 
              { 
                borderTopColor: theme.semanticColors.border,
                zIndex: isDrawerVisible || isSettingsDrawerVisible ? -1 : 1,
                opacity: isDrawerVisible || isSettingsDrawerVisible ? 0 : 1,
                paddingBottom: Math.max(insets.bottom, 16),
              }
            ]}
          >
            <Composer
              onSend={handleSendMessage}
              onSendFile={user?.id ? (file) => sendFileMessage(file, user.id, currentSession?.id) : undefined}
              onSendCombinedFileAndText={user?.id ? handleSendCombinedFileAndText : undefined}
              onAddOptimisticMessage={handleAddOptimisticMessage}
              placeholder={
                isSending
                  ? "Sending message..."
                  : isEditingMessage 
                    ? "Saving edit..." 
                    : isLoading 
                      ? "Starting conversation..." 
                      : "What's on your mind?"
              }
              disabled={!canMakeQuery || isLoading || isEditingMessage || isSending}
              sessionId={currentSession?.id}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* DRAWERS MOVED OUTSIDE SafeAreaView - ALWAYS STATIC */}
      <Drawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        title="Conversations"
        stickyHeader={
          /* NEW CONVERSATION BUTTON - ALWAYS VISIBLE */
          <TouchableOpacity
            style={[styles.newConversationButton, { backgroundColor: theme.semanticColors.surface, borderColor: theme.semanticColors.border }]}
            onPress={() => {
              setIsDrawerVisible(false);
              console.log('🆕 ChatScreen: Starting NEW EMPTY conversation from drawer');
              
              // Clear ALL session state but STAY on ChatScreen for empty experience
              clearMessages(); // This now also clears currentSession
              setCurrentSession(null); // Extra safety
              
              // Don't navigate - just clear the current session to show empty state
            }}
          >
            <Ionicons name="add" size={20} color={theme.semanticColors.primary} />
            <Text style={[styles.newConversationText, { color: theme.semanticColors.primary }]}>
              New Conversation
            </Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.drawerContent}>
          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.drawerText, { color: theme.semanticColors.textSecondary }]}>
                Your conversations will appear here after you start chatting.
              </Text>
            </View>
          ) : (
            <View style={styles.sessionsList}>
              {sessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={[
                    styles.sessionItem,
                    { 
                      backgroundColor: currentSession?.id === session.id 
                        ? theme.semanticColors.primary + '20' 
                        : 'transparent',
                      borderColor: theme.semanticColors.border
                    }
                  ]}
                  onPress={async () => {
                    setIsDrawerVisible(false);
                    try {
                      console.log(`📱 User selected session: ${session.id}`);
                      await loadSession(session.id);
                    } catch (error) {
                      console.error('Failed to load selected session:', error);
                      Alert.alert('Error', 'Failed to load conversation. Please try again.');
                    }
                  }}
                >
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: theme.semanticColors.textPrimary }]} numberOfLines={1}>
                      {session.title || `Chat ${new Date(session.created_at).toLocaleDateString()}`}
                    </Text>
                    <Text style={[styles.sessionMeta, { color: theme.semanticColors.textSecondary }]}>
                      {session.message_count} messages • {new Date(session.created_at).toLocaleDateString()}
                    </Text>
                    {session.last_message_at && (
                      <Text style={[styles.sessionLastActivity, { color: theme.semanticColors.textSecondary }]}>
                        Last activity: {new Date(session.last_message_at).toLocaleTimeString()}
                      </Text>
                    )}
                  </View>
                  
                  {/* Action buttons */}
                  <View style={styles.sessionActions}>
                    {/* Rename button */}
                    <TouchableOpacity
                      style={styles.renameButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        console.log('🖱️ ChatScreen: Rename button pressed for:', session.id);
                        handleRenamePress(session);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={18} color={theme.semanticColors.textSecondary} />
                    </TouchableOpacity>
                    
                    {/* Delete button */}
                    <TouchableOpacity
                      style={[styles.deleteButton, styles.deleteActionButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        console.log('🖱️ ChatScreen: DELETE button pressed for:', session.id);
                        console.log('🖱️ ChatScreen: Session title:', session.title);
                        Alert.alert(
                          'Delete Conversation',
                          'Are you sure you want to delete this conversation? This action cannot be undone.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Delete', 
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  console.log(`🔥 ChatScreen: Deleting conversation ${session.id}`);
                                  
                                  // Close drawer first for better UX
                                  setIsDrawerVisible(false);
                                  
                                  // Check if we're deleting the currently active session
                                  const isDeletingActiveSession = currentSession?.id === session.id;
                                  
                                  // 🔥 Use deleteSession from useChat to update drawer
                                  await deleteSession(session.id);
                                  
                                  console.log(`✨ Instant delete completed in ChatScreen for: ${session.id}`);
                                  
                                  // 🔥 Navigate back to HomeScreen if we deleted the active session
                                  if (isDeletingActiveSession) {
                                    console.log('🏠 Navigating to HomeScreen after deleting active session');
                                    navigation.navigate('Home' as never);
                                  }
                                } catch (error) {
                                  console.error('Failed to delete conversation:', error);
                                  Alert.alert('Error', 'Failed to delete conversation. Please try again.');
                                }
                              }
                            }
                          ]
                        );
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
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
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
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
    paddingHorizontal: 0,
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
}); 