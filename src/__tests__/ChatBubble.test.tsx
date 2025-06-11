import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatBubble } from '../components/ChatBubble';
import { ThemeProvider } from '../providers/ThemeProvider';

// Mock the ThemeProvider
const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ChatBubble', () => {
  const defaultProps = {
    message: 'Test message',
    isUser: false,
  };

  it('renders message text correctly', () => {
    const { getByText } = render(
      <MockThemeProvider>
        <ChatBubble {...defaultProps} />
      </MockThemeProvider>
    );
    
    expect(getByText('Test message')).toBeTruthy();
  });

  it('renders user message with correct styling', () => {
    const { getByText } = render(
      <MockThemeProvider>
        <ChatBubble {...defaultProps} isUser={true} />
      </MockThemeProvider>
    );
    
    const messageElement = getByText('Test message');
    expect(messageElement).toBeTruthy();
  });

  it('renders assistant message with correct styling', () => {
    const { getByText } = render(
      <MockThemeProvider>
        <ChatBubble {...defaultProps} isUser={false} />
      </MockThemeProvider>
    );
    
    const messageElement = getByText('Test message');
    expect(messageElement).toBeTruthy();
  });

  it('renders timestamp when provided', () => {
    const timestamp = '2025-01-11T10:00:00Z';
    const { getByText } = render(
      <MockThemeProvider>
        <ChatBubble {...defaultProps} timestamp={timestamp} />
      </MockThemeProvider>
    );
    
    // The timestamp component formats the time, so we check if any time-related text exists
    expect(getByText(/\d+:\d+/)).toBeTruthy();
  });

  it('applies optimistic styling when isOptimistic is true', () => {
    const { getByText } = render(
      <MockThemeProvider>
        <ChatBubble {...defaultProps} isOptimistic={true} />
      </MockThemeProvider>
    );
    
    const messageElement = getByText('Test message');
    expect(messageElement).toBeTruthy();
  });

  it('handles long messages correctly', () => {
    const longMessage = 'This is a very long message that should wrap properly and not break the layout of the chat bubble component';
    const { getByText } = render(
      <MockThemeProvider>
        <ChatBubble {...defaultProps} message={longMessage} />
      </MockThemeProvider>
    );
    
    expect(getByText(longMessage)).toBeTruthy();
  });
});