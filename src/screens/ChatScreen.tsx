import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { Composer } from '../components/Composer';
import { ChatBubble } from '../components/ChatBubble';
import { TypingDots } from '../components/TypingDots';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { PillPrompt } from '../components/PillPrompt';
import { Drawer } from '../components/Drawer';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { Ionicons } from '@expo/vector-icons';


type ChatScreenNavigationProp = DrawerNavigationProp<any>;

const SUGGESTED_PROMPTS = [
  'Handle credit grabber',
  'Negotiate salary',
  'Diffuse conflict',
  'Manage difficult boss',
  'Network authentically',
];

interface RouteParams {
  sessionId?: string;
  initialMessage?: string;
}

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute();
  const { sessionId, initialMessage } = (route.params as RouteParams) || {};
  const { theme } = useTheme();
  const { user, tier, canMakeQuery } = useAuth();
  
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isSettingsDrawerVisible, setIsSettingsDrawerVisible] = useState(false);
  const [hasProcessedInitialMessage, setHasProcessedInitialMessage] = useState(false);
  
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
    error,
    sendMessage,
    loadSession,
    deleteSession,
    renameSession,
  } = useChat();

  // 🔥 Use instant operations from useConversations for consistency with HomeScreen
  const { renameConversationInstant, deleteConversationInstant } = useConversations();

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

  const handleSendMessage = async (message: string) => {
    if (!canMakeQuery) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      console.log(`📝 Sending message to current session: ${currentSession?.id}`);
      await sendMessage(message, currentSession?.id, false); // Use non-streaming for better UX
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      console.error('Send message error:', error);
    }
  };

  const handleSuggestedPress = async (prompt: string) => {
    if (!canMakeQuery) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      console.log(`📝 Sending suggested prompt to current session: ${currentSession?.id}`);
      await sendMessage(prompt, currentSession?.id, false); // Use non-streaming for better UX
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      console.error('Suggested prompt error:', error);
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

  const renderMessage = ({ item }: { item: any }) => {
    return (
      <ChatBubble
        message={item.content}
        isUser={item.role === 'user'}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Header - Same as HomeScreen */}
      <View style={styles.header}>
        {/* Hamburger Menu */}
        <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
        </TouchableOpacity>

        {/* Settings Button */}
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => setIsSettingsDrawerVisible(true)}
        >
          <Ionicons name="settings-outline" size={24} color={theme.semanticColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

        {/* Suggested Prompts - Show ONLY when starting a completely new conversation */}
        {messages.length === 0 && !isStreaming && !isThinking && !initialMessage && !sessionId && !isLoading && (
          <View style={styles.promptChipsContainer}>
            <Text style={[styles.promptChipsTitle, { color: theme.semanticColors.textSecondary }]}>
              Try asking about:
            </Text>
            {SUGGESTED_PROMPTS.map((prompt, index) => (
              <PillPrompt
                key={prompt}
                text={prompt}
                onPress={() => handleSuggestedPress(prompt)}
                delay={index * 100}
              />
            ))}
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#FF6B6B' }]}>
            <Text style={[styles.errorText, { color: '#FFFFFF' }]}>
              {error || 'Something went wrong'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Composer - Same as HomeScreen */}
      <View style={[styles.composerContainer, { borderTopColor: theme.semanticColors.border }]}>
        <Composer
          onSend={handleSendMessage}
          onUpload={handleUpload}
          onVoiceNote={handleVoiceNote}
          placeholder={isLoading ? "Starting conversation..." : "What's on your mind?"}
          disabled={!canMakeQuery || isLoading}
        />
      </View>

      {/* Drawer - Same as HomeScreen */}
      <Drawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        title="Conversations"
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
                                  // 🔥 Use instant delete for immediate UI feedback
                                  await deleteConversationInstant(session.id);
                                  // Close drawer after successful deletion
                                  setIsDrawerVisible(false);
                                  console.log(`✨ Instant delete completed in ChatScreen`);
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

      {/* Settings Drawer - Same as HomeScreen */}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
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
  settingsButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  promptChipsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  promptChipsTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  sessionsList: {
    flex: 1,
    paddingTop: 8,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
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
    fontSize: 12,
    marginBottom: 2,
  },
  sessionLastActivity: {
    fontSize: 11,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  renameButton: {
    padding: 8,
    borderRadius: 6,
    marginRight: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    padding: 24,
    borderRadius: 12,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveButton: {
    // backgroundColor set dynamically with theme
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 