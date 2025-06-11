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
import { useAuth } from '../contexts/AuthContext';
import { useConversations, Message } from '../hooks/useConversations';
import { useTheme } from '../src/providers/ThemeProvider';

const SUGGESTED_PROMPTS = [
  'Handle credit grabber',
  'Negotiate salary',
  'Diffuse conflict',
  'Manage difficult boss',
  'Network authentically',
];

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { theme } = useTheme();

  const { tier, dailyCounter, canAsk, decrementCounter } = useAuth();
  const { conversations, getConversation, createConversation, addMessageToConversation } = useConversations();

  // @ts-ignore - navigation params
  const conversationId = route.params?.conversationId;
  const currentConversation = conversationId ? getConversation(conversationId) : null;

  const [messages, setMessages] = useState<Message[]>(currentConversation?.messages || []);
  const [isSending, setIsSending] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Update messages when conversation changes
  useEffect(() => {
    if (currentConversation) {
      setMessages(currentConversation.messages);
    } else {
      setMessages([]);
    }
  }, [currentConversation]);

  const getEngineLabel = () => {
    return tier === 'power' ? 'Power Strategist' : 'Essential Coach';
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

    let activeConversationId = conversationId;

    // Create new conversation if none exists
    if (!activeConversationId) {
      const newConv = createConversation(text.trim());
      activeConversationId = newConv.id;
      // Navigate to the new conversation
      navigation.setParams({ conversationId: activeConversationId } as never);
    } else {
      // Add message to existing conversation
      addMessageToConversation(activeConversationId, {
        role: 'user',
        content: text.trim()
      });
    }

    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    // Decrement counter for non-power users
    if (tier !== 'power') {
      await decrementCounter();
    }

    try {
      // Simulate AI response (in a real app, this would call your backend)
      setTimeout(() => {
        const responses = [
          "That's a great question about professional relationships. Let me help you navigate this situation with a strategic approach...",
          "I understand this is challenging. Here are some evidence-based strategies that have worked well for others in similar situations...",
          "This is a common workplace dynamic. Let me break down some practical steps you can take to address this effectively...",
          "Great question! This requires a thoughtful approach. Here's how I'd recommend handling this situation...",
          "I can see why this would be frustrating. Let me share some proven techniques for managing this type of professional challenge..."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: randomResponse,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Add assistant message to conversation
        if (activeConversationId) {
          addMessageToConversation(activeConversationId, {
            role: 'assistant',
            content: randomResponse
          });
        }
        
        setIsSending(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send message');
      setIsSending(false);
    }
  }, [messages, conversationId, canAsk, tier, decrementCounter, createConversation, addMessageToConversation, navigation]);

  const handleSuggestedPress = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  const handleMic = useCallback(() => {
    if (tier !== 'power') {
      toast.info('Voice input is available for Power Strategist users');
      setShowPaywall(true);
      return;
    }
    toast.info('Voice input coming soon');
  }, [tier]);

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

  const voiceEnabled = tier === 'power';

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.semanticColors.background }]} 
      keyboardVerticalOffset={insets.top + 70} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: theme.semanticColors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.semanticColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.engineLabel, { color: theme.semanticColors.textPrimary }]}>
          {getEngineLabel()}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {messages.length === 0 && (
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
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 16, 
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 24,
  },
  engineLabel: { 
    fontWeight: '600', 
    fontSize: 16,
  },
  headerRight: {
    width: 24,
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
});