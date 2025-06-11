import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  isOptimistic?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isUser,
  timestamp,
  isOptimistic = false,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.assistantContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser ? [styles.userBubble, { backgroundColor: theme.accent }] : [styles.assistantBubble, { backgroundColor: theme.surface }],
        isOptimistic && styles.optimisticBubble
      ]}>
        <Text style={[
          styles.messageText,
          isUser ? [styles.userText, { color: theme.surface }] : [styles.assistantText, { color: theme.textPrimary }],
          isOptimistic && { opacity: 0.7 }
        ]}>
          {message}
        </Text>
      </View>
      {timestamp && (
        <Text style={[
          styles.timestamp,
          { color: theme.textSecondary },
          isUser ? styles.userTimestamp : styles.assistantTimestamp
        ]}>
          {timestamp}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  optimisticBubble: {
    borderStyle: 'dashed',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    fontWeight: '500',
  },
  assistantText: {
    fontWeight: '400',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    marginHorizontal: 8,
  },
  userTimestamp: {
    textAlign: 'right',
  },
  assistantTimestamp: {
    textAlign: 'left',
  },
});