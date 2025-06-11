import React from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  animatedValue?: Animated.Value;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isUser, 
  timestamp,
  animatedValue = new Animated.Value(1)
}) => {
  const { theme, isDark } = useTheme();

  const dynamicBubbleStyle: ViewStyle = {
    backgroundColor: isUser 
      ? theme.semanticColors.primary 
      : (isDark ? theme.colors.jet : '#F5F5F5'),
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    shadowColor: theme.semanticColors.shadow,
  };

  const bubbleStyle = [
    styles.bubble,
    dynamicBubbleStyle,
    isUser ? styles.userBubble : styles.assistantBubble
  ];

  const textStyle = [
    styles.messageText,
    {
      color: isUser 
        ? '#FFFFFF' 
        : theme.semanticColors.textPrimary
    }
  ];

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: animatedValue,
          transform: [{
            translateY: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            })
          }]
        }
      ]}
    >
      <View style={bubbleStyle}>
        <Text style={textStyle}>{message}</Text>
        {timestamp && (
          <Text style={[styles.timestamp, { 
            color: isUser ? 'rgba(255,255,255,0.7)' : theme.semanticColors.textSecondary 
          }]}>
            {timestamp}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12, // 12px radius as specified
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, // Faint shadow
    shadowRadius: 3,
    elevation: 2,
  },
  userBubble: {
    marginLeft: 40,
  },
  assistantBubble: {
    marginRight: 40,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
});