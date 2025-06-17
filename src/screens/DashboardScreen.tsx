import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { ActionButton } from '../components/ActionButton';
import ChatComposer from '../../components/ChatComposer';
import { ChatBubble } from '../components/ChatBubble';
import { TypingDots } from '../components/TypingDots';
import { useChat } from '../hooks/useChat';
import { usePersonalizationPrompts } from '../hooks/usePersonalizationPrompts';

import { generateAiPrompts } from '../services/aiPromptService';
import { Ionicons } from '@expo/vector-icons';

type DashboardScreenNavigationProp = DrawerNavigationProp<any>;

const actionButtons = [
  { title: 'Evaluate Scenario', icon: 'analytics-outline' as const },
  { title: 'Plan Strategy', icon: 'map-outline' as const },
  { title: 'Analyze Stakeholders', icon: 'people-outline' as const },
  { title: 'Summarize Policy', icon: 'document-text-outline' as const },
  { title: 'Brainstorm Insights', icon: 'bulb-outline' as const },
  { title: 'Draft Email', icon: 'mail-outline' as const },
];

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { theme } = useTheme();
  const { user, tier, canMakeQuery } = useAuth();
  const [showActions, setShowActions] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [morePrompts, setMorePrompts] = useState<string[]>([]);
  
  const {
    messages,
    isTyping,
    isSending,
    error,
    sendMessage,
    canSendMessage,
  } = useChat();

  const { prompts, loading: promptsLoading, personalizationData } = usePersonalizationPrompts();

  const handleActionPress = async (actionTitle: string) => {
    if (!canSendMessage) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setShowActions(false);
      await sendMessage(`Help me with: ${actionTitle}`, actionTitle.toLowerCase().replace(' ', '_'));
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      console.error('Action error:', error);
    }
  };

  const handlePromptPress = (prompt: string) => {
    setInputText(prompt);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const aiPrompts = await generateAiPrompts(5);
      setMorePrompts(aiPrompts);
    } catch (error) {
      console.error('Error loading more prompts:', error);
      // Show fallback prompts on error
      setMorePrompts([
        "How can I better manage stakeholder expectations?",
        "What's the key to effective cross-functional collaboration?",
        "How do I build credibility in a new role?",
        "What strategies help me influence organizational change?",
        "How can I improve my negotiation skills?"
      ]);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!canSendMessage) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setShowActions(false);
      await sendMessage(message);
      setInputText(''); // Clear input after sending
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      console.error('Send message error:', error);
    }
  };

  const handleImageUpload = () => {
    Alert.alert('Image Upload', 'Image upload feature coming soon!');
  };

  const handleMicPress = () => {
    if (tier !== 'shark') {
      Alert.alert(
        'Premium Feature',
        'Voice features are available for Power Strategist tier only.',
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert('Voice Input', 'Voice input feature coming soon!');
  };

  const renderMessage = ({ item }: { item: any }) => (
    <ChatBubble
      message={item.content}
      isUser={item.role === 'user'}
      timestamp={item.timestamp}
    />
  );

  const renderPromptPill = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.promptPill, { backgroundColor: theme.semanticColors.accent, borderColor: theme.semanticColors.accent }]}
      onPress={() => handlePromptPress(item)}
      disabled={!canSendMessage}
    >
      <Text style={[styles.promptText, { color: theme.semanticColors.surface }]} numberOfLines={2}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  const renderAiPromptPill = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.aiPromptPill, { 
        backgroundColor: theme.semanticColors.surface, 
        borderColor: theme.semanticColors.accent 
      }]}
      onPress={() => handlePromptPress(item)}
      disabled={!canSendMessage}
    >
      <Text style={[styles.promptText, { color: theme.semanticColors.textPrimary }]} numberOfLines={2}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Header - Same as HomeScreen */}
      <View style={styles.header}>
        {/* Hamburger Menu */}
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
        </TouchableOpacity>

        {/* Settings Button */}
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => console.log('Settings pressed')} // TODO: Implement settings navigation
        >
          <Ionicons name="settings-outline" size={24} color={theme.semanticColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Messages or Dashboard Content */}
        {messages.length === 0 && showActions ? (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Personalized Prompts Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                Quick Prompts for You
              </Text>
              {promptsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.semanticColors.accent} />
                  <Text style={[styles.loadingText, { color: theme.semanticColors.textSecondary }]}>
                    Loading personalized prompts...
                  </Text>
                </View>
              ) : (
                <View>
                  <FlatList
                    data={prompts}
                    renderItem={renderPromptPill}
                    keyExtractor={(item, index) => `prompt-${index}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.promptsContainer}
                  />
                  
                  {/* Load More Button */}
                  {morePrompts.length === 0 && (
                    <View style={styles.loadMoreContainer}>
                      {!isLoadingMore ? (
                        <TouchableOpacity 
                          style={[styles.loadMoreButton, { borderColor: theme.semanticColors.accent }]}
                          onPress={handleLoadMore}
                          disabled={!canSendMessage}
                        >
                          <Ionicons 
                            name="add-circle-outline" 
                            size={20} 
                            color={theme.semanticColors.accent} 
                          />
                          <Text style={[styles.loadMoreText, { color: theme.semanticColors.accent }]}>
                            Load more suggestions
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.loadMoreButton, { borderColor: theme.semanticColors.accent }]}>
                          <ActivityIndicator size="small" color={theme.semanticColors.accent} />
                          <Text style={[styles.loadMoreText, { color: theme.semanticColors.textSecondary }]}>
                            Generating suggestions...
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* AI Generated Prompts */}
                  {morePrompts.length > 0 && (
                    <View style={styles.aiPromptsSection}>
                      <Text style={[styles.aiPromptsLabel, { color: theme.semanticColors.textSecondary }]}>
                        AI Suggestions
                      </Text>
                      <FlatList
                        data={morePrompts}
                        renderItem={renderAiPromptPill}
                        keyExtractor={(item, index) => `ai-prompt-${index}`}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.promptsContainer}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Action Buttons Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                Quick Actions
              </Text>
              <View style={styles.gridContainer}>
                {actionButtons.map((button, index) => (
                  <View key={index} style={styles.gridItem}>
                    <ActionButton
                      title={button.title}
                      icon={button.icon}
                      onPress={() => handleActionPress(button.title)}
                      disabled={!canSendMessage}
                    />
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isTyping ? <TypingDots visible={true} /> : null
            }
          />
        )}

        {/* Error Display */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#FF6B6B' }]}>
            <Text style={[styles.errorText, { color: theme.semanticColors.surface }]}>
              {error.message || 'Something went wrong'}
            </Text>
          </View>
        )}

        {/* Chat Composer */}
        <View style={[styles.composerContainer, { backgroundColor: theme.semanticColors.surface, borderTopColor: theme.semanticColors.border }]}>
          <ChatComposer
            onSend={handleSendMessage}
            voiceEnabled={tier === 'shark'}
            disabled={!canSendMessage || isSending}
            accentColor={theme.semanticColors.accent}
            onMicPress={handleMicPress}
            inputText={inputText}
            onInputChange={setInputText}
          />
          
          {/* Image Upload Button */}
          <TouchableOpacity
            style={[styles.imageButton, { borderColor: theme.semanticColors.border }]}
            onPress={handleImageUpload}
            disabled={!canSendMessage || isSending}
          >
            <Ionicons 
              name="camera" 
              size={24} 
              color={!canSendMessage || isSending ? theme.semanticColors.textSecondary : theme.semanticColors.textPrimary} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
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
  promptsContainer: {
    paddingRight: 16,
  },
  promptPill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 12,
    maxWidth: 250,
    minWidth: 150,
    borderWidth: 1,
  },
  promptText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 12,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 8,
  },
  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  aiPromptPill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 12,
    minWidth: 120,
    maxWidth: 200,
    borderWidth: 2,
  },
  loadMoreContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  aiPromptsSection: {
    marginTop: 16,
  },
  aiPromptsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
}); 