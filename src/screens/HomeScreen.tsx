import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, ActivityIndicator, ToastAndroid, Platform, Image, Alert, Modal, TextInput, StatusBar, KeyboardAvoidingView, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { monitoring } from '../services/monitoring';
import { Pill } from '../components/Pill';
import { Composer } from '../components/Composer';
import { Drawer } from '../components/Drawer';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { usePersonalizationPrompts } from '../hooks/usePersonalizationPrompts';
import { useChat } from '../hooks/useChat';
import { generateAiPrompts } from '../services/aiPromptService';
import { supabase } from '../lib/supabase';
import { useConversations } from '../hooks/useConversations';
import { SatoshiText } from '../components/SatoshiText';
import { SharkToggleIcon } from '../components/SharkToggleIcon';


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
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { clearAllData, user, tier } = useAuth();
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  // Track screen view
  React.useEffect(() => {
    monitoring.trackScreenView('Home', {
      user_tier: tier,
      user_id: user?.id,
    });
  }, [tier, user?.id]);
  const [isSettingsDrawerVisible, setIsSettingsDrawerVisible] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [heroQuestion] = useState(HERO_QUESTIONS[0]); // TODO: Make this contextual
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [morePrompts, setMorePrompts] = useState<string[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const aiPromptsAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Rename modal state
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  // Delete confirmation modal state
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState<any>(null);

  // Get personalized prompts
  const { prompts: personalizedPrompts, loading: promptsLoading, personalizationData } = usePersonalizationPrompts();
  
  // Use the real API-based conversations hook
  const { 
    conversations, 
    loading: conversationsLoading, 
    refreshConversations,
    triggerRefreshAfterMessage,
    renameConversationInstant,
    deleteConversationInstant
  } = useConversations();

  // Use chat hook for session management
  const { deleteSession, renameSession, sendFileMessage, sendCombinedFileAndTextMessage, appendMessage, updateMessage, removeMessage, createSession } = useChat();

  // State for voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // Add state to track attached files from Composer
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);

  // Use chat hook for session management
  useEffect(() => {
    // Animate content on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();

    // Note: conversations are automatically loaded by the useConversations hook
  }, [fadeAnim, slideAnim]);

  // Refresh conversations when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshConversations();
    });

    return unsubscribe;
  }, [navigation, refreshConversations]);

  const startConversation = async (message: string, attachments?: any[]) => {
    if (!user?.id || isSendingMessage) return;
    
    setIsSendingMessage(true);
    try {
      // 🔥 Navigate directly to chat screen with message - let ChatScreen handle everything
      // No need to refresh conversations here - ChatScreen will create the session
      // and useConversations will automatically pick it up
      (navigation as any).navigate('Chat', { 
        initialMessage: message,
        initialAttachments: attachments
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

  const handleSendMessage = async (message: string, attachments?: any[]) => {
    if (!message.trim() && !attachments?.length) return;
    
    // 🔥 CRITICAL: Detect file attachments and handle Enhanced File Flow BEFORE navigation
    const hasAttachments = attachments && attachments.length > 0;
    
    if (hasAttachments && user?.id) {
      console.log('🚀 [HomeScreen] Detected file attachments, starting Enhanced File Flow');
      setIsSendingMessage(true);
      setIsProcessingFile(true);
      
      try {
        // Step 1: Create session FIRST
        console.log('🆕 [HomeScreen] Creating session for file upload...');
        const file = attachments[0];
        const fileTypeLabel = file.isRAGDocument ? 'Document' : 'Image';
        const sessionTitle = message.trim() ? `${message.trim().substring(0, 30)}...` : `${fileTypeLabel}: ${file.name}`;
        
        const newSession = await createSession(sessionTitle);
        if (!newSession) {
          throw new Error('Failed to create session');
        }
        
        console.log('✅ [HomeScreen] Session created:', newSession.id);
        
        // Step 2: Generate UUIDs for optimistic messages
        const generateUUID = (): string => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        
        const textMessageId = message.trim() ? generateUUID() : '';
        const fileMessageId = generateUUID();
        
        // Step 3: Add optimistic user message with file attachment
        const optimisticMessage = {
          id: message.trim() ? textMessageId : fileMessageId,
          content: message.trim() || `Uploading ${file.name}...`,
          role: 'user' as 'user',
          session_id: newSession.id,
          created_at: new Date().toISOString(),
          type: message.trim() ? 'text_with_file' as 'text_with_file' : 'file' as 'file',
          filename: file.name,
          fileUrl: file.uri,
          fileSize: file.size,
          fileType: file.type,
          status: 'uploading' as 'uploading',
          metadata: {
            hasAttachment: true,
            file_url: file.uri,
            fileType: file.type,
            processingStatus: 'uploading'
          }
        };
        
        // Add optimistic message to store
        appendMessage(optimisticMessage);
        
        // Step 4: Navigate to ChatScreen with session and processing state
        console.log('🚀 [HomeScreen] Navigating to ChatScreen with Enhanced File Flow state');
        (navigation as any).navigate('Chat', { 
          sessionId: newSession.id,
          initialAttachments: attachments,
          initialMessage: message.trim(),
          textMessageId,
          fileMessageId,
          isProcessingFile: true
        });
        
      } catch (error) {
        console.error('❌ [HomeScreen] Enhanced File Flow failed:', error);
        Alert.alert('Error', 'Failed to start conversation with file. Please try again.');
        setIsProcessingFile(false);
      } finally {
        setIsSendingMessage(false);
      }
      
      return;
    }
    
    // Regular text-only conversation
    await startConversation(message.trim());
  };

  const handlePromptPress = async (prompt: string) => {
    if (isSendingMessage) return;
    
    // 🔥 ALWAYS create new conversation for prompts
    // Each prompt should start a fresh conversation, not navigate to existing ones
    setSelectedPrompt(selectedPrompt === prompt ? null : prompt);
    await startConversation(prompt);
  };

  const navigateToChat = (conversationId: string) => {
    (navigation as any).navigate('Chat', { 
      sessionId: conversationId,
      conversationId: conversationId
    });
    setIsDrawerVisible(false);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    // Start spinning animation
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    spinLoop.start();
    
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
        useNativeDriver: false,
      }).start();
      
    } catch (error) {
      console.error('💥 Failed to generate AI prompts:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Failed to load more suggestions', ToastAndroid.SHORT);
      }
    } finally {
      setIsLoadingMore(false);
      // Stop spinning animation and reset
      spinLoop.stop();
      spinAnim.setValue(0);
    }
  };

  const handleMenuPress = () => {
    Keyboard.dismiss(); // Dismiss keyboard before opening drawer
    setIsDrawerVisible(true);
    // Note: We no longer fetch conversations here since they're loaded once at app start
    // and refreshed when new conversations are created
  };

  const handleUpload = () => {
    console.log('Upload pressed');
  };

  // VOICE RECORDING DISABLED - Remove permission issues  
  const handleVoiceNote = async () => {
    Alert.alert(
      'Voice Recording', 
      'Voice recording feature will be available in the next update.',
      [{ text: 'OK' }]
    );
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleRenamePress = (conversation: any) => {
    setRenamingSessionId(conversation.id);
    setRenameInputValue(conversation.title || '');
    setIsRenameModalVisible(true);
  };

  const handleRenameSubmit = async () => {
    if (!renamingSessionId || !renameInputValue.trim()) {
      Alert.alert('Error', 'Please enter a valid title');
      return;
    }

    // Store values before clearing state
    const sessionId = renamingSessionId;
    const newTitle = renameInputValue.trim();

    // Close modal immediately - UI updates are optimistic
    setIsRenameModalVisible(false);
    setRenamingSessionId(null);
    setRenameInputValue('');

    try {
      // 🔥 Use instant rename - UI updates immediately, backend syncs in background
      await renameConversationInstant(sessionId, newTitle);
      console.log(`✨ Instant rename completed successfully`);
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      // Even if backend fails, we don't reopen the modal since UI was already updated
      // The rollback will happen automatically in renameConversationInstant
      Alert.alert('Warning', 'Rename saved locally but failed to sync with server. Changes may be lost.');
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

  // Callback to receive attached files from Composer
  const handleAttachedFilesChange = (files: any[]) => {
    setAttachedFiles(files);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semanticColors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.semanticColors.background} />
      
      <KeyboardAvoidingView 
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 24 })}
        style={{ flex: 1 }}
      >
        {/* Header */}
      <View style={[styles.header, { paddingTop: 0 }]}>
        {/* Hamburger Menu */}
        <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
        </TouchableOpacity>

        {/* Header Right: Shark Toggle + Settings */}
        <View style={{ flexDirection: 'row', gap: 8, marginRight: -8 }}>
          <SharkToggleIcon />
          <TouchableOpacity 
            style={styles.settingsButton} 
            onPress={() => {
              Keyboard.dismiss(); // Dismiss keyboard before opening settings drawer
              setIsSettingsDrawerVisible(true);
            }}
          >
            <Ionicons name="settings-outline" size={24} color={theme.semanticColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content - Wrap in SafeAreaView for bottom edge */}
      <View style={styles.contentContainer}>
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
            <SatoshiText 
              variant="header" 
              weight="bold" 
              style={styles.heroQuestion}
            >
              {heroQuestion}
            </SatoshiText>

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
                      <TouchableOpacity 
                        style={styles.loadMoreIcon}
                        onPress={handleLoadMore}
                        disabled={isLoadingMore}
                      >
                        <Animated.View style={{
                          transform: [{
                            rotate: spinAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg']
                            })
                          }]
                        }}>
                          <Image 
                            source={require('../../media/icons/loadMoreSugeestionsIcon_lightmode.png')}
                            style={[
                              styles.loadMoreIconImage,
                              { opacity: isLoadingMore ? 0.7 : 1 }
                            ]}
                            resizeMode="contain"
                          />
                        </Animated.View>
                      </TouchableOpacity>
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

        {/* Composer with minimal bottom spacing */}
        <View 
          style={[
            styles.composerContainer,
            { 
              backgroundColor: theme.semanticColors.background,
              zIndex: isDrawerVisible || isSettingsDrawerVisible ? -1 : 1,
              opacity: isDrawerVisible || isSettingsDrawerVisible ? 0 : 1,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 16, // Use safe area insets or minimal padding
            }
          ]}
        >
          <Composer
            onSend={(message: string, attachments?: any[]) => handleSendMessage(message, attachments || attachedFiles)}
            onAttachedFilesChange={handleAttachedFilesChange}
            placeholder={
              transcription 
                ? `🎙️ ${transcription}` 
                : (isSendingMessage ? "Starting conversation..." : "What's on your mind?")
            }
            disabled={isSendingMessage || isProcessingFile}
            sessionId={undefined} // Will be updated when we have active session
            isRecording={isRecording}
            liveTranscription={transcription}
            isProcessingFile={isProcessingFile}
            setFileProcessingState={setIsProcessingFile}
          />
        </View>
      </View>
      </KeyboardAvoidingView>

      {/* Drawer */}
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
              console.log('🆕 HomeScreen: Starting NEW EMPTY conversation from drawer');
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
                      navigateToChat(conversation.id);
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

      {/* Settings Drawer */}
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
    paddingTop: 20,
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
  contentContainer: {
    flex: 1,
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
    marginHorizontal: 16,
    alignItems: 'flex-start', // Ensure pills align properly when heights vary
  },
  prompt: {
    marginBottom: 8, // Reduced from 12 since gap handles spacing
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
    borderColor: '#4A90E2',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderStyle: 'solid',
  },
  aiPromptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: '20%',
    width: '100%',
    alignItems: 'flex-start', // Ensure pills align properly when heights vary
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
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
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
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
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
  deleteButton: {
    // backgroundColor set to red in JSX
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
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