import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ComposerProps {
  onSend: (message: string) => void;
  onUpload?: () => void;
  onVoiceNote?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onUpload,
  onVoiceNote,
  placeholder = "What's on your mind?",
  disabled = false,
}) => {
  const { theme } = useTheme();
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      Keyboard.dismiss();
    }
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.semanticColors.border, theme.semanticColors.primary],
  });

  return (
    <View style={styles.container}>
      {/* Text Input Area (Upper Half) */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            backgroundColor: theme.semanticColors.surface,
            borderColor,
            shadowColor: theme.semanticColors.shadow,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            {
              color: theme.semanticColors.textPrimary,
            },
          ]}
          value={message}
          onChangeText={setMessage}
          placeholder={placeholder}
          placeholderTextColor={theme.semanticColors.textSecondary}
          multiline
          maxLength={500}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          editable={!disabled}
        />
        
        {/* Send Button */}
        {message.trim().length > 0 && (
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: theme.semanticColors.primary,
              },
            ]}
            onPress={handleSend}
            disabled={disabled}
          >
            <View style={styles.sendIcon} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Action Buttons Area (Lower Half) */}
      <View style={styles.actionsContainer}>
        {/* Upload Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.semanticColors.surface,
              borderColor: theme.semanticColors.border,
            },
          ]}
          onPress={onUpload}
          disabled={disabled}
        >
          <View style={[styles.uploadIcon, { backgroundColor: theme.semanticColors.textSecondary }]} />
        </TouchableOpacity>

        {/* Voice Note Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.semanticColors.surface,
              borderColor: theme.semanticColors.border,
            },
          ]}
          onPress={onVoiceNote}
          disabled={disabled}
        >
          <View style={[styles.micIcon, { backgroundColor: theme.semanticColors.textSecondary }]} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    minHeight: 80,
    maxHeight: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: '#FFFFFF',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  uploadIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
    position: 'relative',
  },
  micIcon: {
    width: 12,
    height: 16,
    borderRadius: 6,
  },
}); 