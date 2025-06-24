import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Text, KeyboardAvoidingView, Platform, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { toast } from 'sonner-native';
import ChatComposer from '../components/ChatComposer';
import PaywallBottomSheet from '../components/PaywallBottomSheet';
import { ChatBubble } from '../src/components/ChatBubble';

import { Drawer } from '../src/components/Drawer';
import { SettingsDrawer } from '../src/components/SettingsDrawer';
import { useAuth } from '../contexts/AuthContext';
import { useConversations, Message } from '../src/hooks/useConversations';
import { useTheme } from '../src/providers/ThemeProvider';
import { apiFetch } from '../src/lib/api';



interface ChatResponse {
  id: string;
  message: string;
  timestamp: string;
  sessionId: string;
  model: string;
  usage: {
    tokensUsed: number;
    remainingQueries?: number;
  };
}

interface SessionData {
  session: {
    id: string;
    title: string;
    created_at: string;
    last_message_at?: string;
    message_count: number;
  };
  messages: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
    session_id: string;
  }[];
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { theme, isDark } = useTheme();

  const { tier, dailyCounter, canAsk, decrementCounter } = useAuth();
  const { conversations, getConversation, createConversation, addMessageToConversation, updateMessage } = useConversations();

  // @ts-ignore - navigation params
  const routeParams = route.params as any;
  const conversationId = routeParams?.conversationId;
  const sessionId = routeParams?.sessionId;
  const initialMessage = routeParams?.initialMessage;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  
  // Drawer states to match HomeScreen
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isSettingsDrawerVisible, setIsSettingsDrawerVisible] = useState(false);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Load session data when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else if (initialMessage) {
      // Send initial message if provided
      sendMessage(initialMessage);
    }
  }, [sessionId, initialMessage]);

  const loadSession = async (sessionId: string) => {
    setIsLoadingSession(true);
    try {
      const sessionData = await apiFetch<SessionData>(`/chat/sessions/${sessionId}`);
      
      setCurrentSessionId(sessionData.session.id);
      setSessionTitle(sessionData.session.title);
      
      // Convert API messages to local format
      const convertedMessages: Message[] = sessionData.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
      }));
      
      setMessages(convertedMessages);
    } catch (error) {
      console.error('Failed to load session:', error);
      toast.error('Failed to load conversation');
    } finally {
      setIsLoadingSession(false);
    }
  };

  const getEngineLabel = () => {
    return tier === 'shark' ? 'Shark Strategist' : 'Essential Coach';
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Check if user can ask
    if (!canAsk()) {
      setShowPaywall(true);
      return;
    }

    // Create a temporary message with a temp ID
    const tempId = `temp-${Date.now()}`;
    const userMessage: Message = { 
      id: tempId,
      role: 'user', 
      content: text.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    // Decrement counter for non-shark users
    if (tier !== 'shark') {
      await decrementCounter();
    }

    try {
      // Send message to API
      const response = await apiFetch<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text.trim(),
          sessionId: currentSessionId,
          actionType: 'general_coaching',
        }),
      });

      console.log('✅ OpenAI Response:', response);

      // Update session ID if this is a new conversation
      if (!currentSessionId) {
        setCurrentSessionId(response.sessionId);
        // Update URL params to include session ID
        navigation.setParams({ sessionId: response.sessionId } as never);
      }

      // Now reload the session to get the proper database IDs
      if (response.sessionId) {
        console.log('🔄 Reloading session to sync database IDs...');
        await loadSession(response.sessionId);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
      
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    } finally {
      setIsSending(false);
    }
  }, [canAsk, tier, decrementCounter, currentSessionId, navigation, loadSession]);



  const handleMic = useCallback(() => {
    if (tier !== 'shark') {
      toast.info('Voice input is available for Shark Strategist users');
      setShowPaywall(true);
      return;
    }
    toast.info('Voice input coming soon');
  }, [tier]);

  // Navigation handlers to match HomeScreen
  const handleMenuPress = () => {
    setIsDrawerVisible(true);
  };

  const handleNavigateToSubscriptions = () => {
    setIsSettingsDrawerVisible(false);
    (navigation as any).navigate('Subscriptions');
  };

  const handleNavigateToOnboardingEdit = () => {
    setIsSettingsDrawerVisible(false);
    (navigation as any).navigate('OnboardingEdit');
  };

  const handleEditMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    if (!currentSessionId) {
      throw new Error('No active session');
    }

    try {
      console.log(`🔧 Editing message ${messageId} in session ${currentSessionId}`);
      
      // Find the message being edited
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) {
        throw new Error('Message not found in local state');
      }

      const editedMessage = messages[messageIndex];
      if (editedMessage.role !== 'user') {
        throw new Error('Only user messages can be edited');
      }

      // Update the message in the database
      await updateMessage(currentSessionId, messageId, newContent);
      
      // Update local messages state and remove all subsequent messages
      setMessages(prev => {
        const updatedMessages = [...prev];
        // Update the edited message
        updatedMessages[messageIndex] = { ...editedMessage, content: newContent };
        // Remove all messages after the edited one
        return updatedMessages.slice(0, messageIndex + 1);
      });

      // Regenerate AI response for the edited message
      console.log('🤖 Regenerating AI response for edited message...');
      setIsSending(true);

      try {
        const response = await apiFetch<ChatResponse>('/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: newContent.trim(),
            sessionId: currentSessionId,
            actionType: 'general_coaching',
          }),
        });

        console.log('✅ Regenerated AI Response:', response);

        // Add the new AI response
        const newAssistantMessage: Message = {
          id: response.id,
          role: 'assistant',
          content: response.message,
          timestamp: response.timestamp,
        };

        setMessages(prev => [...prev, newAssistantMessage]);

        // Reload session to ensure all database IDs are in sync
        setTimeout(() => {
          console.log('🔄 Reloading session after edit to sync IDs...');
          loadSession(currentSessionId);
        }, 1000);

      } catch (aiError) {
        console.error('Failed to regenerate AI response:', aiError);
        toast.error('Message updated, but failed to generate new AI response');
      } finally {
        setIsSending(false);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to edit message:', error);
      throw error;
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const animatedValue = new Animated.Value(0);
    
    // Animate message appearance
    useEffect(() => {
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <ChatBubble
        message={item.content}
        messageId={item.id}
        conversationId={currentSessionId || ''}
        isUser={item.role === 'user'}
        timestamp={new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        animatedValue={animatedValue}
        onEditMessage={handleEditMessage}
        isStreaming={isSending && index === messages.length - 1 && item.role === 'assistant'}
      />
    );
  };

  const voiceEnabled = tier === 'shark';

  if (isLoadingSession) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.semanticColors.background }]} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.semanticColors.background} />
        {/* Header */}
        <View style={[styles.header, { paddingTop: 0 }]}>
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
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.semanticColors.textSecondary }]}>
            Loading conversation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />



          {/* Composer Container with proper keyboard handling */}
          <View 
            style={[
              styles.composerContainer, 
              { 
                backgroundColor: theme.semanticColors.background,
                zIndex: isDrawerVisible || isSettingsDrawerVisible ? -1 : 1,
                opacity: isDrawerVisible || isSettingsDrawerVisible ? 0 : 1,
                paddingBottom: Math.max(insets.bottom, 16),
              }
            ]}
          >
            <ChatComposer
              onSend={sendMessage}
              voiceEnabled={voiceEnabled}
              disabled={isSending}
              accentColor={theme.semanticColors.primary}
              onMicPress={handleMic}
              onFileAttach={(fileUrl, fileName, fileType) => {
                // Create a file attachment message and route into conversation
                const fileMessage = `📎 Attached file: ${fileName}\n\nFile URL: ${fileUrl}`;
                sendMessage(fileMessage);
              }}
              sessionId={currentSessionId || undefined}
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
              console.log('🆕 Old ChatScreen: Starting new conversation');
              // Navigate to HomeScreen for fresh start
              navigation.navigate('Home' as never);
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
          <Text style={[styles.drawerText, { color: theme.semanticColors.textSecondary }]}>
            Your conversations will appear here after you start chatting.
          </Text>
        </View>
      </Drawer>

      {/* Settings Drawer - ALWAYS STATIC */}
      <SettingsDrawer
        isVisible={isSettingsDrawerVisible}
        onClose={() => setIsSettingsDrawerVisible(false)}
        onNavigateToSubscriptions={handleNavigateToSubscriptions}
        onNavigateToOnboardingEdit={handleNavigateToOnboardingEdit}
      />

      <PaywallBottomSheet 
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </>
  );
}

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
    zIndex: 100, // Ensure header stays above content
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
  list: { 
    padding: 16, 
    paddingBottom: 0,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 16,
    paddingTop: 8,
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
});