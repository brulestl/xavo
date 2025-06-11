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
    timestamp: {
      control: 'text',
      description: 'Optional timestamp to display',
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

export const UserMessage: Story = {
  args: {
    message: "How should I handle a difficult colleague who takes credit for my work?",
    isUser: true,
    timestamp: "2:30 PM",
  },
};

export const AssistantMessage: Story = {
  args: {
    message: "That's a challenging situation. Here are some strategies you can use to address this professionally while protecting your contributions...",
    isUser: false,
    timestamp: "2:31 PM",
  },
};

export const LongMessage: Story = {
  args: {
    message: "I've been working on a project for months, and my manager keeps giving all the credit to another team member during meetings. This person hasn't contributed much to the actual work, but they're very vocal about it in front of leadership. I'm frustrated and don't know how to address this without seeming petty or confrontational.",
    isUser: true,
    timestamp: "2:30 PM",
  },
};

export const WithoutTimestamp: Story = {
  args: {
    message: "I understand your frustration. Let me help you navigate this situation strategically.",
    isUser: false,
  },
};