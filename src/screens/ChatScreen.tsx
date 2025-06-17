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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { Composer } from '../components/Composer';
import { ChatBubble } from '../components/ChatBubble';
import { TypingDots } from '../components/TypingDots';
import { PillPrompt } from '../components/PillPrompt';
import { Drawer } from '../components/Drawer';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { useChat } from '../hooks/useChat';
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
  
  const {
    messages,
    sessions,
    currentSession,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    loadSession,
    deleteSession,
  } = useChat();

  const flatListRef = useRef<FlatList>(null);

  // DEBUG: Log messages array changes
  useEffect(() => {
    console.log('🔍 ChatScreen messages updated:', {
      count: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content?.substring(0, 50) + '...',
        isStreaming: m.isStreaming
      }))
    });
  }, [messages]);

  // DEBUG: Log loading states
  useEffect(() => {
    console.log('🔍 ChatScreen state:', { isLoading, isStreaming, error });
  }, [isLoading, isStreaming, error]);

  // DEBUG: Log sessions data
  useEffect(() => {
    console.log('🔍 ChatScreen sessions updated:', {
      count: sessions.length,
      currentSessionId: currentSession?.id,
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        messageCount: s.message_count,
        createdAt: s.created_at
      }))
    });
  }, [sessions, currentSession]);

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
        // If we have a sessionId, load that session
        if (sessionId) {
          // Preserve current messages if we already have some (e.g., during streaming)
          const preserveMessages = messages.length > 0;
          console.log(`🖥️ ChatScreen loading session ${sessionId}, preserveMessages: ${preserveMessages}`);
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
  }, [sessionId, initialMessage, hasProcessedInitialMessage]);

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
      await sendMessage(message, sessionId);
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
      await sendMessage(prompt, sessionId);
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

  const renderMessage = ({ item }: { item: any }) => {
    console.log('🔍 Rendering message:', {
      id: item.id,
      role: item.role,
      content: item.content?.substring(0, 30) + '...',
      isUser: item.role === 'user'
    });
    
    return (
      <ChatBubble
        message={item.content}
        isUser={item.role === 'user'}
        timestamp={item.created_at}
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

        {/* DEBUG: Status indicator */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.semanticColors.textSecondary, fontSize: 12 }}>
            Messages: {messages.length} | Loading: {isLoading ? 'Y' : 'N'} | Streaming: {isStreaming ? 'Y' : 'N'}
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
            isStreaming ? <TypingDots visible={true} /> : null
          }
          ListEmptyComponent={
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#666', fontSize: 16 }}>
                {isLoading ? 'Loading messages...' : 'No messages yet'}
              </Text>
              <Text style={{ color: '#999', fontSize: 14, marginTop: 8 }}>
                DEBUG: Messages array length: {messages.length}
              </Text>
            </View>
          }
        />

        {/* Suggested Prompts - Show when no messages */}
        {messages.length === 0 && !isStreaming && !initialMessage && (
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
                    await loadSession(session.id);
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
                  
                  {/* Delete button */}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert(
                        'Delete Conversation',
                        'Are you sure you want to delete this conversation? This action cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Delete', 
                            style: 'destructive',
                            onPress: () => deleteSession(session.id)
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.semanticColors.textSecondary} />
                  </TouchableOpacity>
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
  deleteButton: {
    padding: 8,
    borderRadius: 6,
  },
}); 