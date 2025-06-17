import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Text, KeyboardAvoidingView, Platform, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { toast } from 'sonner-native';
import ChatComposer from '../components/ChatComposer';
import PaywallBottomSheet from '../components/PaywallBottomSheet';
import { ChatBubble } from '../src/components/ChatBubble';
import { PillPrompt } from '../src/components/PillPrompt';
import { Drawer } from '../src/components/Drawer';
import { SettingsDrawer } from '../src/components/SettingsDrawer';
import { useAuth } from '../contexts/AuthContext';
import { useConversations, Message } from '../hooks/useConversations';
import { useTheme } from '../src/providers/ThemeProvider';
import { apiFetch } from '../src/lib/api';

const SUGGESTED_PROMPTS = [
  'Handle credit grabber',
  'Negotiate salary',
  'Diffuse conflict',
  'Manage difficult boss',
  'Network authentically',
];

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
  const { theme } = useTheme();

  const { tier, dailyCounter, canAsk, decrementCounter } = useAuth();
  const { conversations, getConversation, createConversation, addMessageToConversation } = useConversations();

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

    const userMessage: Message = { 
      id: Date.now().toString(), 
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

      // Add assistant message
      const assistantMessage: Message = {
        id: response.id,
        role: 'assistant',
        content: response.message,
        timestamp: response.timestamp,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
      
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }, [canAsk, tier, decrementCounter, currentSessionId, navigation]);

  const handleSuggestedPress = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

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
        isUser={item.role === 'user'}
        timestamp={new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        animatedValue={animatedValue}
      />
    );
  };

  const voiceEnabled = tier === 'shark';

  if (isLoadingSession) {
    return (
      <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
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
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.semanticColors.textSecondary }]}>
            Loading conversation...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.semanticColors.background }]} 
      keyboardVerticalOffset={insets.top + 70} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header - Exact same as HomeScreen */}
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

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {messages.length === 0 && !isSending && (
        <View style={styles.promptChipsContainer}>
          <Text style={[styles.promptChipsTitle, { color: theme.semanticColors.textSecondary }]}>
            Try asking about:
          </Text>
          {SUGGESTED_PROMPTS.map((prompt, index) => (
            <PillPrompt
              key={prompt}
              text={prompt}
              onPress={() => handleSuggestedPress(prompt)}
              delay={index * 100} // Staggered animation
            />
          ))}
        </View>
      )}

      <ChatComposer
        onSend={sendMessage}
        voiceEnabled={voiceEnabled}
        disabled={isSending}
        accentColor={theme.semanticColors.primary}
        onMicPress={handleMic}
      />

      {/* Drawer - Same as HomeScreen */}
      <Drawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        title="Conversations"
      >
        <View style={styles.drawerContent}>
          <Text style={[styles.drawerText, { color: theme.semanticColors.textSecondary }]}>
            Your conversations will appear here after you start chatting.
          </Text>
        </View>
      </Drawer>

      {/* Settings Drawer - Same as HomeScreen */}
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
    </KeyboardAvoidingView>
  );
}

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
  list: { 
    padding: 16, 
    paddingBottom: 0,
  },
  promptChipsContainer: { 
    padding: 16,
    paddingTop: 8,
  },
  promptChipsTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
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
  drawerContent: {
    paddingVertical: 20,
  },
  drawerText: {
    fontSize: 16,
    textAlign: 'center',
  },
});