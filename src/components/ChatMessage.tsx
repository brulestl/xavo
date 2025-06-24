import React from 'react';
import { Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../providers/ThemeProvider';
import { markdownStyles } from './markdownStyles';

interface ChatMessageProps {
  text: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ text }) => {
  const { theme } = useTheme();

  const handleLinkPress = (url: string) => {
    Linking.openURL(url).catch(err => {
      console.error('Failed to open URL:', err);
    });
  };

  return (
    <Markdown
      style={markdownStyles(theme.semanticColors)}
      mergeStyle={false}
      onLinkPress={handleLinkPress}
    >
      {text}
    </Markdown>
  );
}; 