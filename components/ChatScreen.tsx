import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useChat, ChatMessage } from '../hooks/useChat';

// Skeleton loader for messages
const MessageSkeleton: React.FC = () => (
  <View style={styles.skeletonContainer}>
    {[1, 2, 3].map((index) => (
      <View key={index} style={styles.skeletonMessage}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '70%' }]} />
        </View>
      </View>
    ))}
  </View>
);

// Typing indicator component
const TypingIndicator: React.FC = () => (
  <View style={[styles.messageContainer, styles.assistantMessage]}>
    <View style={styles.messageContent}>
      <View style={styles.typingIndicator}>
        <View style={styles.typingDot} />
        <View style={[styles.typingDot, { animationDelay: '0.2s' }]} />
        <View style={[styles.typingDot, { animationDelay: '0.4s' }]} />
      </View>
    </View>
  </View>
);

// Message component
const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <View style={[
      styles.messageContainer,
      isUser ? styles.userMessage : styles.assistantMessage
    ]}>
      <View style={[
        styles.messageContent,
        isUser ? styles.userMessageContent : styles.assistantMessageContent
      ]}>
        <Text style={[
          styles.messageText,
          isUser ? styles.userMessageText : styles.assistantMessageText
        ]}>
          {message.content}
        </Text>
        
        {message.isStreaming && (
          <View style={styles.streamingIndicator}>
            <ActivityIndicator size="small" color="#007bff" />
          </View>
        )}
        
        {message.function_calls && message.function_calls.length > 0 && (
          <View style={styles.functionCallsContainer}>
            <Text style={styles.functionCallsLabel}>Actions taken:</Text>
            {message.function_calls.map((call, index) => (
              <Text key={index} style={styles.functionCallText}>
                • {call.function?.name || 'Unknown action'}
              </Text>
            ))}
          </View>
        )}
      </View>
      
      <Text style={styles.messageTime}>
        {new Date(message.created_at).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </Text>
    </View>
  );
};

export const ChatScreen: React.FC = () => {
  const {
    messages,
    currentSession,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    createSession,
    retryLastMessage,
  } = useChat();

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;

    const messageText = inputText.trim();
    setInputText('');

    try {
      await sendMessage(messageText, currentSession?.id);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleRetry = async () => {
    try {
      await retryLastMessage();
    } catch (error) {
      console.error('Failed to retry message:', error);
    }
  };

  const handleNewChat = async () => {
    try {
      await createSession();
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageItem message={item} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>Welcome to your AI Coach!</Text>
      <Text style={styles.emptyStateText}>
        I'm here to help you develop your influence and leadership skills. 
        Ask me anything about communication, team management, or career growth.
      </Text>
      <View style={styles.suggestedQuestions}>
        <Text style={styles.suggestedQuestionsTitle}>Try asking:</Text>
        <TouchableOpacity 
          style={styles.suggestionButton}
          onPress={() => setInputText("How can I improve my communication with my team?")}
        >
          <Text style={styles.suggestionText}>
            "How can I improve my communication with my team?"
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.suggestionButton}
          onPress={() => setInputText("What are some effective leadership strategies?")}
        >
          <Text style={styles.suggestionText}>
            "What are some effective leadership strategies?"
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.suggestionButton}
          onPress={() => setInputText("Help me prepare for a difficult conversation")}
        >
          <Text style={styles.suggestionText}>
            "Help me prepare for a difficult conversation"
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Coach</Text>
        </View>
        <MessageSkeleton />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {currentSession?.title || 'AI Coach'}
        </Text>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
          <Text style={styles.newChatButtonText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={[
          styles.messagesContainer,
          messages.length === 0 && styles.messagesContainerEmpty
        ]}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicator */}
      {isStreaming && <TypingIndicator />}

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask your AI coach anything..."
          multiline
          maxLength={1000}
          editable={!isStreaming}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isStreaming) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isStreaming}
        >
          {isStreaming ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  newChatButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007bff',
    borderRadius: 6,
  },
  newChatButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  messagesContainerEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  userMessageContent: {
    backgroundColor: '#007bff',
    borderBottomRightRadius: 4,
  },
  assistantMessageContent: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#212529',
  },
  messageTime: {
    fontSize: 12,
    color: '#6c757d',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  streamingIndicator: {
    marginTop: 8,
    alignItems: 'center',
  },
  functionCallsContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#e7f3ff',
    borderRadius: 8,
  },
  functionCallsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007bff',
    marginBottom: 4,
  },
  functionCallText: {
    fontSize: 12,
    color: '#495057',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c757d',
    // Note: React Native doesn't support CSS animations
    // You might want to use a library like react-native-reanimated for this
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  suggestedQuestions: {
    width: '100%',
    gap: 12,
  },
  suggestedQuestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  suggestionButton: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  suggestionText: {
    fontSize: 14,
    color: '#007bff',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#007bff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8d7da',
    borderTopWidth: 1,
    borderTopColor: '#f5c6cb',
  },
  errorText: {
    flex: 1,
    color: '#721c24',
    fontSize: 14,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#dc3545',
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Skeleton loader styles
  skeletonContainer: {
    padding: 16,
    gap: 16,
  },
  skeletonMessage: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
  },
  skeletonContent: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
  },
}); 