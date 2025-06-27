import React from 'react';
import { Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../providers/ThemeProvider';
import { markdownStyles } from './markdownStyles';

interface ChatMessageProps {
  text: string;
  textColor?: string;
  isUserMessage?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ text, textColor, isUserMessage = false }) => {
  const { theme } = useTheme();

  const handleLinkPress = (url: string): boolean => {
    Linking.openURL(url).catch(err => {
      console.error('Failed to open URL:', err);
    });
    return true;
  };

  // Use provided textColor or determine based on message type
  const messageTextColor = textColor || (isUserMessage ? theme.getUserMessageTextColor() : theme.semanticColors.textPrimary);

  // Create custom styles with the correct text color
  const customSemanticColors = {
    ...theme.semanticColors,
    textPrimary: messageTextColor,
    textSecondary: isUserMessage ? 'rgba(255,255,255,0.8)' : theme.semanticColors.textSecondary,
  };

  return (
    <Markdown
      style={markdownStyles(customSemanticColors)}
      mergeStyle={false}
      onLinkPress={handleLinkPress}
    >
      {text}
    </Markdown>
  );
}; 