import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, ActivityIndicator, ToastAndroid, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { Pill } from '../components/Pill';
import { Composer } from '../components/Composer';
import { Drawer } from '../components/Drawer';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { usePersonalizationPrompts } from '../hooks/usePersonalizationPrompts';
import { generateAiPrompts } from '../services/aiPromptService';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';

// Mock data - TODO: Replace with actual user data from onboarding
const HERO_QUESTIONS = [
  "What's blocking your next move?",
  "How can I help you navigate this challenge?",
  "What conversation are you avoiding?",
  "What leadership skill needs work?",
];

const QUICK_PROMPTS = [
  "Difficult conversation prep",
  "Team conflict resolution",
  "Salary negotiation tips",
  "Leadership presence",
  "Networking strategies",
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

interface ConversationSession {
  id: string;
  title?: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
}

export const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { clearAllData, user } = useAuth();
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isSettingsDrawerVisible, setIsSettingsDrawerVisible] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [heroQuestion] = useState(HERO_QUESTIONS[0]); // TODO: Make this contextual
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [morePrompts, setMorePrompts] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const aiPromptsAnim = useRef(new Animated.Value(0)).current;

  // Get personalized prompts
  const { prompts: personalizedPrompts, loading: promptsLoading, personalizationData } = usePersonalizationPrompts();

  useEffect(() => {
    // Animate content on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Load conversations once when app starts
    if (user?.id && !conversationsLoaded) {
      loadConversationsFromSupabase();
    }
  }, [fadeAnim, slideAnim, user?.id, conversationsLoaded]);

  const loadConversationsFromSupabase = async () => {
    if (!user?.id || isLoadingConversations) return;
    
    setIsLoadingConversations(true);
    try {
      console.log('📱 Loading conversations from Supabase for user:', user.id);
      
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('id, title, created_at, last_message_at, message_count')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('❌ Error loading conversations:', error);
        return;
      }

      console.log('✅ Loaded conversations:', data?.length || 0);
      setConversations(data || []);
      setConversationsLoaded(true);
    } catch (error) {
      console.error('💥 Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const startConversation = async (message: string) => {
    if (!user?.id || isSendingMessage) return;
    
    setIsSendingMessage(true);
    try {
      // Send message to OpenAI API (temporarily without auth)
      const response = await apiFetch<ChatResponse>('/chat', {
        method: 'POST',
        auth: false, // Temporarily disable auth for testing
        body: JSON.stringify({
          message: message,
          actionType: 'general_chat',
        }),
      });

      console.log('✅ OpenAI Response:', response);

      // Refresh conversations list to include the new one
      await loadConversationsFromSupabase();

      // Navigate to chat screen with the new session
      (navigation as any).navigate('Chat', { 
        sessionId: response.sessionId,
        initialMessage: message 
      });

    } catch (error) {
      console.error('Failed to start conversation:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Failed to start conversation. Please try again.', ToastAndroid.SHORT);
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
    await startConversation(message.trim());
  };

  const handlePromptPress = async (prompt: string) => {
    if (isSendingMessage) return;
    
    setSelectedPrompt(selectedPrompt === prompt ? null : prompt);
    // Start conversation with the selected prompt
    await startConversation(prompt);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      if (!user?.id || !personalizationData) {
        console.log('❌ Missing user ID or personalization data for AI prompts');
        return;
      }

             console.log('🤖 Generating AI prompts for user:', user.id);
       const aiPrompts = await generateAiPrompts(user.id, 5);
      
      setMorePrompts(aiPrompts);
      
      // Animate the new prompts in
      Animated.timing(aiPromptsAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      
    } catch (error) {
      console.error('💥 Failed to generate AI prompts:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Failed to load more suggestions', ToastAndroid.SHORT);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleMenuPress = () => {
    setIsDrawerVisible(true);
    // Note: We no longer fetch conversations here since they're loaded once at app start
    // and refreshed when new conversations are created
  };

  const handleUpload = () => {
    console.log('Upload pressed');
  };

  const handleVoiceNote = () => {
    console.log('Voice note pressed');
  };

  const handleNavigateToSubscriptions = () => {
    setIsSettingsDrawerVisible(false);
    (navigation as any).navigate('Subscriptions');
  };

  const handleNavigateToOnboardingEdit = () => {
    setIsSettingsDrawerVisible(false);
    (navigation as any).navigate('OnboardingEdit');
  };

  const handleSignOut = async () => {
    await clearAllData();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Header */}
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

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Hero Question */}
          <Text style={[styles.heroQuestion, { color: theme.semanticColors.textPrimary }]}>
            {heroQuestion}
          </Text>

          {/* Quick Prompts */}
          <Animated.View style={styles.promptsWrapper}>
            {promptsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.semanticColors.accent} />
                <Text style={[styles.loadingText, { color: theme.semanticColors.textSecondary }]}>
                  Loading personalized prompts...
                </Text>
              </View>
            ) : (
              <>
                {/* First Row: Exactly 5 Personalized Prompts from Database */}
                <View style={styles.promptsContainer}>
                  {personalizedPrompts.slice(0, 5).map((prompt, index) => (
                    <Pill
                      key={`personalized-${index}`}
                      title={prompt}
                      variant={selectedPrompt === prompt ? 'selected' : 'default'}
                      onPress={() => handlePromptPress(prompt)}
                      style={styles.prompt}
                      disabled={isSendingMessage}
                    />
                  ))}
                </View>
                
                {/* Load More Icon */}
                {morePrompts.length === 0 && (
                  <View style={styles.loadMoreContainer}>
                    <Animated.View style={{ opacity: isLoadingMore ? 0 : 1 }}>
                      <TouchableOpacity 
                        style={styles.loadMoreIcon}
                        onPress={handleLoadMore}
                        disabled={isLoadingMore}
                      >
                        <Image 
                          source={require('../../media/icons/loadMoreSugeestionsIcon_lightmode.png')}
                          style={styles.loadMoreIconImage}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    </Animated.View>
                    
                    {isLoadingMore && (
                      <Animated.View style={[styles.loadMoreSpinner, { opacity: isLoadingMore ? 1 : 0 }]}>
                        <ActivityIndicator size="small" color={theme.semanticColors.accent} />
                      </Animated.View>
                    )}
                  </View>
                )}
                
                {/* Second Row: Exactly 5 AI-Generated Prompts with Distinct Styling */}
                {morePrompts.length > 0 && (
                  <Animated.View 
                    style={[
                      styles.aiPromptsWrapper,
                      {
                        opacity: aiPromptsAnim,
                        transform: [
                          {
                            translateY: aiPromptsAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={[styles.aiPromptsLabel, { color: theme.semanticColors.textSecondary }]}>
                      AI Suggestions
                    </Text>
                    <View style={styles.aiPromptsContainer}>
                      {morePrompts.slice(0, 5).map((prompt, index) => (
                        <Pill
                          key={`ai-${index}`}
                          title={prompt}
                          variant={selectedPrompt === prompt ? 'selected' : 'default'}
                          onPress={() => handlePromptPress(prompt)}
                          style={[styles.prompt, styles.aiPill]}
                          disabled={isSendingMessage}
                        />
                      ))}
                    </View>
                  </Animated.View>
                )}
              </>
            )}
          </Animated.View>
        </Animated.View>
      </ScrollView>

      {/* Composer */}
      <View style={styles.composerContainer}>
        <Composer
          onSend={handleSendMessage}
          onUpload={handleUpload}
          onVoiceNote={handleVoiceNote}
          placeholder={isSendingMessage ? "Starting conversation..." : "What's on your mind?"}
          disabled={isSendingMessage}
        />
      </View>

      {/* Drawer */}
      <Drawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        title="Conversations"
      >
        <View style={styles.drawerContent}>
          {isLoadingConversations ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.semanticColors.accent} />
              <Text style={[styles.loadingText, { color: theme.semanticColors.textSecondary }]}>
                Loading conversations...
              </Text>
            </View>
          ) : conversations.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {conversations.map((conversation) => (
                <TouchableOpacity
                  key={conversation.id}
                  style={[styles.conversationItem, { borderBottomColor: theme.semanticColors.border }]}
                  onPress={() => {
                    setIsDrawerVisible(false);
                    (navigation as any).navigate('Chat', { sessionId: conversation.id });
                  }}
                >
                  <View style={styles.conversationContent}>
                    <Text style={[styles.conversationTitle, { color: theme.semanticColors.textPrimary }]} numberOfLines={1}>
                      {conversation.title || 'Untitled Conversation'}
                    </Text>
                    <Text style={[styles.conversationDate, { color: theme.semanticColors.textSecondary }]}>
                      {new Date(conversation.last_message_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={16} 
                    color={theme.semanticColors.textSecondary} 
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.drawerText, { color: theme.semanticColors.textSecondary }]}>
              Your conversations will appear here after you start chatting.
            </Text>
          )}
        </View>
      </Drawer>

      {/* Settings Drawer */}
      <SettingsDrawer
        isVisible={isSettingsDrawerVisible}
        onClose={() => setIsSettingsDrawerVisible(false)}
        onNavigateToSubscriptions={handleNavigateToSubscriptions}
        onNavigateToOnboardingEdit={handleNavigateToOnboardingEdit}
      />
    </View>
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
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  heroQuestion: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 36,
  },
  promptsWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  promptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  prompt: {
    marginBottom: 12,
  },
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  drawerContent: {
    paddingVertical: 20,
  },
  drawerText: {
    fontSize: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  loadMoreContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    width: '100%',
  },
  loadMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    backgroundColor: 'transparent',
    minHeight: 40,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  aiPromptsWrapper: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  aiPromptsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  aiPill: {
    borderWidth: 1,
    borderColor: '#4A90E2', // Solid blue border for AI-generated prompts
    backgroundColor: 'rgba(74, 144, 226, 0.1)', // Lighter background
    borderStyle: 'solid', // Solid border for AI-generated prompts
  },
  aiPromptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: '20%', // 20% margin from left and right
    width: '100%',
  },
  loadMoreIcon: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreIconImage: {
    width: 40,
    height: 40,
  },
  loadMoreSpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPrompt: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  conversationDate: {
    fontSize: 12,
  },
}); 