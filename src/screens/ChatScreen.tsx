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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { ActionButton } from '../components/ActionButton';
import ChatComposer from '../../components/ChatComposer';
import { ChatBubble } from '../components/ChatBubble';
import { TypingDots } from '../components/TypingDots';
import { Timestamp } from '../components/Timestamp';
import { useChat } from '../hooks/useChat';
import { Ionicons } from '@expo/vector-icons';

type ChatScreenNavigationProp = DrawerNavigationProp<any>;

const actionButtons = [
  { title: 'Evaluate Scenario', icon: 'analytics-outline' as const },
  { title: 'Plan Strategy', icon: 'map-outline' as const },
  { title: 'Analyze Stakeholders', icon: 'people-outline' as const },
  { title: 'Summarize Policy', icon: 'document-text-outline' as const },
  { title: 'Brainstorm Insights', icon: 'bulb-outline' as const },
  { title: 'Draft Email', icon: 'mail-outline' as const },
];

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { theme } = useTheme();
  const { user, tier, canMakeQuery } = useAuth();
  const [showActions, setShowActions] = useState(true);
  
  const {
    messages,
    isTyping,
    isSending,
    error,
    sendMessage,
    canSendMessage,
  } = useChat();

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
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      console.error('Send message error:', error);
    }
  };

  const handleImageUpload = () => {
    Alert.alert('Image Upload', 'Image upload feature coming soon!');
  };

  const handleMicPress = () => {
    if (tier !== 'power') {
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
      isOptimistic={item.isOptimistic}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.screenBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.openDrawer()}
        >
          <Ionicons name="menu" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Corporate Influence Coach
        </Text>
        
        <View style={styles.menuButton} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Messages or Action Buttons */}
        {messages.length === 0 && showActions ? (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
            <Text style={[styles.errorText, { color: theme.surface }]}>
              {error.message || 'Something went wrong'}
            </Text>
          </View>
        )}

        {/* Chat Composer */}
        <View style={[styles.composerContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <ChatComposer
            onSend={handleSendMessage}
            voiceEnabled={tier === 'power'}
            disabled={!canSendMessage || isSending}
            accentColor={theme.accent}
            onMicPress={handleMicPress}
          />
          
          {/* Image Upload Button */}
          <TouchableOpacity
            style={[styles.imageButton, { borderColor: theme.border }]}
            onPress={handleImageUpload}
            disabled={!canSendMessage || isSending}
          >
            <Ionicons 
              name="camera" 
              size={24} 
              color={!canSendMessage || isSending ? theme.textSecondary : theme.textPrimary} 
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 8,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
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
}); 