import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const mockResponses = [
  "That sounds like a challenging situation. Let me help you navigate this relationship dynamic...",
  "I understand your concern. Here's a perspective that might help you approach this conversation...",
  "Great question! Building stronger relationships often starts with understanding the other person's perspective...",
  "This is a common workplace challenge. Let's explore some strategies to improve this relationship...",
  "Communication is key in any relationship. Here's how you can frame this conversation more effectively...",
];

export const ChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const { tier, canMakeQuery, incrementQueryCount, dailyQueryCount } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hi! I\'m your AI relationship coach. How can I help you improve your relationships today?',
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    if (!canMakeQuery()) {
      Alert.alert(
        'Daily Limit Reached',
        `You've used all ${tier === 'guest' ? 3 : 3} daily queries. Upgrade to Power Strategist for unlimited access!`,
        [{ text: 'OK' }]
      );
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    // Increment query count
    await incrementQueryCount();

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setLoading(false);
    }, 1500);
  };

  const getTierLabel = () => {
    switch (tier) {
      case 'guest': return 'Guest Mode';
      case 'essential': return 'Essential Coach';
      case 'power': return 'Power Strategist';
      default: return 'Guest Mode';
    }
  };

  const getQueriesRemaining = () => {
    if (tier === 'power') return 'Unlimited';
    const maxQueries = 3;
    return `${maxQueries - dailyQueryCount} remaining today`;
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <View style={[
        styles.messageBubble,
        {
          backgroundColor: item.isUser ? theme.accent : theme.surface,
          borderColor: theme.border,
        }
      ]}>
        <Text style={[
          styles.messageText,
          { color: item.isUser ? theme.colors.eerieBlack : theme.textPrimary }
        ]}>
          {item.content}
        </Text>
      </View>
    </View>
  );

  return (
    <Container variant="screen" padding="none">
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View>
            <Text style={[styles.tierLabel, { color: theme.accent }]}>
              {getTierLabel()}
            </Text>
            <Text style={[styles.queriesLabel, { color: theme.textSecondary }]}>
              {getQueriesRemaining()}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
        />

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              AI is thinking...
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.textInput, { 
              color: theme.textPrimary,
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            }]}
            placeholder="Ask about any relationship challenge..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <Button
            title="Send"
            onPress={handleSendMessage}
            disabled={!inputText.trim() || loading}
            size="small"
            style={styles.sendButton}
          />
        </View>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  tierLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  queriesLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  aiMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-end',
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
  },
}); 