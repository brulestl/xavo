import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onSend: (text: string) => void;
  voiceEnabled?: boolean;
  disabled?: boolean;
  accentColor?: string;
  onMicPress?: () => void;
  inputText?: string;
  onInputChange?: (text: string) => void;
}

export default function ChatComposer({
  onSend,
  voiceEnabled = false,
  disabled = false,
  accentColor = '#023047',
  onMicPress,
  inputText,
  onInputChange,
}: Props) {
  const [input, setInput] = useState('');

  // Use controlled input if provided, otherwise use internal state
  const currentInput = inputText !== undefined ? inputText : input;
  const setCurrentInput = inputText !== undefined ? (onInputChange || (() => {})) : setInput;

  const handleSend = () => {
    if (!currentInput.trim() || disabled) return;
    onSend(currentInput.trim());
    setCurrentInput('');
  };

  const handleMicPress = () => {
    if (onMicPress) {
      onMicPress();
    }
  };

  return (
    <View style={styles.container}>
      {voiceEnabled && (
        <TouchableOpacity style={styles.micButton} onPress={handleMicPress} disabled={disabled}>
          <Ionicons name="mic" size={24} color={disabled ? '#aaa' : accentColor} />
        </TouchableOpacity>
      )}

      <TextInput
        style={[styles.input, { borderColor: accentColor }]}
        placeholder="What's on your mind?"
        value={currentInput}
        onChangeText={setCurrentInput}
        onSubmitEditing={handleSend}
        editable={!disabled}
      />

      <TouchableOpacity
        onPress={handleSend}
        style={styles.sendButton}
        disabled={disabled}
      >
        <Ionicons
          name="send"
          size={20}
          color={disabled ? '#aaa' : accentColor}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  micButton: { padding: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  sendButton: { padding: 6 },
});