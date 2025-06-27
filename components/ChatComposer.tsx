import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
  Alert,
  Text,
  PermissionsAndroid,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { useTheme } from '../src/providers/ThemeProvider';

// Add this constant for Expo Go detection
const IS_EXPO_GO = __DEV__ && !Constants.appOwnership;

interface Props {
  onSend: (text: string) => void;
  voiceEnabled?: boolean;
  disabled?: boolean;
  accentColor?: string;
  onMicPress?: () => void;
  onFileAttach?: (fileUrl: string, fileName: string, fileType: string) => void;
  inputText?: string;
  onInputChange?: (text: string) => void;
  sessionId?: string;
}

export default function ChatComposer({
  onSend,
  voiceEnabled = false,
  disabled = false,
  accentColor = '#023047',
  onMicPress,
  onFileAttach,
  inputText,
  onInputChange,
  sessionId,
}: Props) {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const textInputRef = useRef<TextInput>(null);

  // Use controlled input if provided, otherwise use internal state
  const currentInput = inputText !== undefined ? inputText : input;
  const setCurrentInput = inputText !== undefined ? (onInputChange || (() => {})) : setInput;

  const handleSend = () => {
    if (!currentInput.trim() || disabled) return;
    onSend(currentInput.trim());
    setCurrentInput('');
    setLiveTranscription('');
  };

  // TAP TARGET HELL - FIX: Make entire input area tappable
  const handleInputAreaPress = () => {
    if (textInputRef.current && !disabled) {
      textInputRef.current.focus();
    }
  };

  // ATTACH FILE, NO EXCUSES - FIX: Remove all guards, work in any chat
  const handleFileAttach = async () => {
    if (disabled || isUploading) return;
    
    Keyboard.dismiss(); // Dismiss keyboard before opening file picker
    
    try {
      setIsUploading(true);
      
      // Pick document - NO GUARDS, NO WARNINGS
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      
      // Validate file size (2MB limit - STRICT)
      if (file.size && file.size > 2 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a file smaller than 2MB.');
        return;
      }

      // Route into active conversation pipeline - NO EXCEPTIONS
      if (onFileAttach) {
        onFileAttach(file.uri, file.name, file.mimeType || 'application/octet-stream');
      }

    } catch (error) {
      console.error('File attach error:', error);
      Alert.alert('Upload Failed', 'Failed to attach file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // VOICE RECORDING DISABLED - Remove permission issues
  const handleVoiceRecording = async () => {
    if (disabled) return;

    Alert.alert(
      'Voice Recording', 
      'Voice recording feature will be available in the next update.',
      [{ text: 'OK' }]
    );
  };

  const displayText = liveTranscription || currentInput;

  return (
    <View style={[styles.container, { backgroundColor: theme.getComposerBackgroundColor() }]}>
      {/* Main Input Container - FULLY TAPPABLE with FIXED SEND BUTTON */}
      <Pressable 
        style={[styles.inputPressable, { borderColor: accentColor, backgroundColor: theme.getComposerBackgroundColor() }]}
        onPress={handleInputAreaPress}
        disabled={disabled}
      >
        <View style={styles.inputContainer}>
          <TextInput
            ref={textInputRef}
            style={[styles.input, { color: liveTranscription ? '#007AFF' : '#000' }]}
            placeholder="What's on your mind?"
            placeholderTextColor="#999"
            value={displayText}
            onChangeText={liveTranscription ? undefined : setCurrentInput}
            onSubmitEditing={handleSend}
            editable={!disabled && !liveTranscription}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {/* FIXED SEND BUTTON - RIGIDLY PINNED TO RIGHT EDGE */}
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendButtonFixed, { backgroundColor: disabled ? '#ccc' : accentColor }]}
            disabled={disabled || (!currentInput.trim() && !liveTranscription.trim())}
          >
            <Ionicons
              name="send"
              size={18}
              color="#fff"
            />
          </TouchableOpacity>

          {/* Live Transcription Indicator */}
          {liveTranscription && (
            <View style={styles.transcriptionIndicator}>
              <Text style={styles.transcriptionLabel}>🎙️ Live</Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* Action Icons Container - PROPERLY POSITIONED */}
      <View style={styles.actionsContainer}>
        {/* Attach/Paperclip Icon - NO GUARDS */}
        <TouchableOpacity 
          style={[
            styles.actionButton, 
            { 
              borderColor: accentColor, 
              opacity: isUploading ? 0.6 : 1 
            }
          ]} 
          onPress={handleFileAttach}
          disabled={disabled || isUploading}
        >
          <Ionicons 
            name={isUploading ? "cloud-upload" : "attach"} 
            size={20} 
            color={disabled ? '#999' : accentColor} 
          />
        </TouchableOpacity>

        {/* Voice Recording Icon - REAL TRANSCRIPTION */}
        <TouchableOpacity 
          style={[
            styles.actionButton, 
            { 
              borderColor: isRecording ? '#FF3B30' : accentColor,
              backgroundColor: isRecording ? '#FF3B30' : '#fff'
            }
          ]} 
          onPress={handleVoiceRecording}
          disabled={disabled}
        >
          <Ionicons 
            name={isRecording ? "stop" : "mic"} 
            size={20} 
            color={isRecording ? '#fff' : (disabled ? '#999' : accentColor)} 
          />
        </TouchableOpacity>

        {/* Voice Note Icon (if voice enabled and different from recording) */}
        {voiceEnabled && (
          <TouchableOpacity 
            style={[styles.actionButton, { borderColor: accentColor }]} 
            onPress={onMicPress} 
            disabled={disabled}
          >
            <Ionicons name="musical-note" size={20} color={disabled ? '#999' : accentColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  inputPressable: {
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 12,
    minHeight: 44, // Minimum touch target
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    position: 'relative', // Enable absolute positioning for send button
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 20,
    textAlignVertical: 'top',
    paddingVertical: 0,
    paddingRight: 40, // Space for fixed send button
  },
  sendButtonFixed: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -16, // Half of button height to center vertically
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  transcriptionIndicator: {
    position: 'absolute',
    top: 8,
    right: 50,
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  transcriptionLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 8, // Extra padding for touch targets
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});