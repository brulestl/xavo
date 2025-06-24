import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import { ChatBubble } from './ChatBubble';
import { ThemeProvider } from '../providers/ThemeProvider';

const meta: Meta<typeof ChatBubble> = {
  title: 'Components/ChatBubble',
  component: ChatBubble,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    message: {
      control: 'text',
      description: 'The message content to display',
    },
    isUser: {
      control: 'boolean',
      description: 'Whether this is a user message or assistant message',
    },
    messageId: {
      control: 'text',
      description: 'Unique identifier for the message',
    },
    conversationId: {
      control: 'text',
      description: 'ID of the conversation this message belongs to',
    },
    timestamp: {
      control: 'text',
      description: 'Optional timestamp to display',
    },
    isStreaming: {
      control: 'boolean',
      description: 'Whether the message is currently being streamed',
    },
  },
  decorators: [
    (Story, context) => (
      <ThemeProvider>
        <View style={{ padding: 20, width: 300 }}>
          <Story {...context} />
        </View>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockEditHandler = async (messageId: string, newContent: string) => {
  console.log(`Editing message ${messageId}: ${newContent}`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  return true;
};

export const UserMessage: Story = {
  args: {
    message: "How should I handle a difficult colleague who takes credit for my work?",
    isUser: true,
    messageId: "user-msg-1",
    conversationId: "conv-123",
    timestamp: "2:30 PM",
    onEditMessage: mockEditHandler,
    isStreaming: false,
  },
};

export const AssistantMessage: Story = {
  args: {
    message: "That's a challenging situation. Here are some strategies you can use to address this professionally while protecting your contributions...",
    isUser: false,
    messageId: "assistant-msg-1",
    conversationId: "conv-123",
    timestamp: "2:31 PM",
    isStreaming: false,
  },
};

export const StreamingMessage: Story = {
  args: {
    message: "I'm analyzing your situation and generating a response...",
    isUser: false,
    messageId: "assistant-msg-2",
    conversationId: "conv-123",
    timestamp: "2:32 PM",
    isStreaming: true,
  },
};

export const LongMessage: Story = {
  args: {
    message: "I've been working on a project for months, and my manager keeps giving all the credit to another team member during meetings. This person hasn't contributed much to the actual work, but they're very vocal about it in front of leadership. I'm frustrated and don't know how to address this without seeming petty or confrontational.",
    isUser: true,
    messageId: "user-msg-2",
    conversationId: "conv-123",
    timestamp: "2:30 PM",
    onEditMessage: mockEditHandler,
    isStreaming: false,
  },
};

export const WithoutEditCallback: Story = {
  args: {
    message: "This user message doesn't have edit capability enabled.",
    isUser: true,
    messageId: "user-msg-3",
    conversationId: "conv-123",
    timestamp: "2:33 PM",
    // No onEditMessage callback provided
    isStreaming: false,
  },
};