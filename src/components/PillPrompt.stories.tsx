import React from 'react';
import { View } from 'react-native';
import { PillPrompt } from './PillPrompt';
import { ThemeProvider } from '../providers/ThemeProvider';

export default {
  title: 'Components/PillPrompt',
  component: PillPrompt,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    text: {
      control: 'text',
      description: 'The text to display in the pill',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the pill is disabled',
    },
    delay: {
      control: 'number',
      description: 'Animation delay in milliseconds',
    },
  },
  decorators: [
    (Story: any) => (
      <ThemeProvider>
        <View style={{ padding: 20, width: 300 }}>
          <Story />
        </View>
      </ThemeProvider>
    ),
  ],
};

export const Default = {
  args: {
    text: "Handle credit grabber",
    onPress: () => console.log('Pill pressed'),
  },
};

export const LongText = {
  args: {
    text: "How to negotiate a salary increase with difficult management",
    onPress: () => console.log('Pill pressed'),
  },
};

export const Disabled = {
  args: {
    text: "Manage difficult boss",
    disabled: true,
    onPress: () => console.log('Pill pressed'),
  },
};

export const WithDelay = {
  args: {
    text: "Network authentically",
    delay: 500,
    onPress: () => console.log('Pill pressed'),
  },
};

export const MultiplePrompts = {
  render: () => (
    <ThemeProvider>
      <View style={{ padding: 20, width: 300 }}>
        {[
          'Handle credit grabber',
          'Negotiate salary',
          'Diffuse conflict',
          'Manage difficult boss',
          'Network authentically',
        ].map((prompt, index) => (
          <PillPrompt
            key={prompt}
            text={prompt}
            delay={index * 100}
            onPress={() => console.log(`Pressed: ${prompt}`)}
          />
        ))}
      </View>
    </ThemeProvider>
  ),
};