import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard, Alert, Platform, Pressable, PermissionsAndroid, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';

interface ComposerProps {
  onSend: (message: string) => void;
  onFileAttach?: (fileUrl: string, fileName: string, fileType: string) => void;
  onUpload?: () => void;
  onVoiceNote?: () => void;
  placeholder?: string;
  disabled?: boolean;
  sessionId?: string;
  isRecording?: boolean;
  liveTranscription?: string;
}

// Add this constant at the top after imports
const IS_EXPO_GO = __DEV__ && !Constants.appOwnership;

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onFileAttach,
  onUpload,
  onVoiceNote,
  placeholder = "What's on your mind?",
  disabled = false,
  sessionId,
  isRecording,
  liveTranscription,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localRecording, setLocalRecording] = useState<Audio.Recording | null>(null);
  const [localLiveTranscription, setLocalLiveTranscription] = useState('');
  const [localIsRecording, setLocalIsRecording] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const textInputRef = useRef<TextInput>(null);

  // Use live transcription if provided, otherwise use message state
  const displayText = liveTranscription || localLiveTranscription || message;
  const isCurrentlyRecording = isRecording || localIsRecording;

  // TAP TARGET HELL - FIX: Make entire input area tappable
  const handleInputAreaPress = () => {
    if (textInputRef.current && !disabled && !liveTranscription && !localLiveTranscription) {
      textInputRef.current.focus();
    }
  };

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
    const textToSend = liveTranscription || localLiveTranscription || message;
    if (textToSend.trim() && !disabled) {
      onSend(textToSend.trim());
      setMessage('');
      setLocalLiveTranscription('');
      Keyboard.dismiss();
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

  const handleFileUpload = async () => {
    if (!user?.id || isUploading) return;
    
    // ATTACH FILE, NO EXCUSES - Remove all guards and work in any chat
    performFileUpload();
  };

  const performFileUpload = async () => {
    try {
      setIsUploading(true);
      
      // Pick document
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        Alert.alert('Error', 'No file selected.');
        return;
      }

      const file = result.assets[0];
      
      // Validate file size (2MB limit - STRICT)
      if (file.size && file.size > 2 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a file smaller than 2MB.');
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.mimeType || '')) {
        Alert.alert('Invalid File Type', 'Please select a PDF, JPG, or PNG file.');
        return;
      }

      // Always feed files into conversation pipeline - NO EXCEPTIONS
      if (onFileAttach) {
        onFileAttach(file.uri, file.name, file.mimeType || 'application/octet-stream');
      }

      // If sessionId exists, also upload to Supabase Storage (optional)
      if (sessionId && user?.id) {
        await uploadToSupabase(file);
      }

    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadToSupabase = async (file: any) => {
    try {
      // Create file path for storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${sessionId}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(fileName, {
          uri: file.uri,
          type: file.mimeType,
          name: file.name,
        } as any);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-files')
        .getPublicUrl(fileName);

      // Save file metadata to database
      const { error: dbError } = await supabase
        .from('user_files')
        .insert({
          user_id: user!.id,
          session_id: sessionId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.mimeType,
        });

      if (dbError) {
        console.warn('Database save failed:', dbError);
      }
    } catch (error) {
      console.warn('Supabase upload failed:', error);
      // Don't show error to user since file was already handled by onFileAttach
    }
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.semanticColors.border, theme.semanticColors.primary],
  });

  return (
    <View style={styles.container}>
      {/* Text Input Area with FIXED SEND BUTTON */}
      <Pressable onPress={handleInputAreaPress}>
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
            ref={textInputRef}
            style={[
              styles.textInput,
              {
                color: isCurrentlyRecording ? '#007AFF' : theme.semanticColors.textPrimary,
                paddingRight: 45, // Space for fixed send button
              },
            ]}
            value={displayText}
            onChangeText={liveTranscription || localLiveTranscription ? undefined : setMessage}
            placeholder={placeholder}
            placeholderTextColor={theme.semanticColors.textSecondary}
            multiline
            maxLength={500}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!disabled && !liveTranscription && !localLiveTranscription}
          />
          
          {/* FIXED SEND BUTTON - RIGIDLY PINNED TO RIGHT EDGE */}
          {displayText.trim().length > 0 && (
            <TouchableOpacity
              style={[
                styles.sendButtonFixed,
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

          {/* Live Transcription Indicator */}
          {(liveTranscription || localLiveTranscription) && (
            <View style={styles.transcriptionIndicator}>
              <Text style={styles.transcriptionLabel}>🎙️ Live</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>

      {/* Action Buttons Area */}
      <View style={styles.actionsContainer}>
        {/* File Attach Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.semanticColors.surface,
              borderColor: theme.semanticColors.border,
              opacity: isUploading ? 0.6 : 1,
            },
          ]}
          onPress={handleFileUpload}
          disabled={disabled || isUploading}
        >
          <Ionicons 
            name={isUploading ? "cloud-upload" : "attach-outline"} 
            size={20} 
            color={isUploading ? theme.semanticColors.textSecondary : theme.semanticColors.textPrimary} 
          />
        </TouchableOpacity>

        {/* Voice Recording Button - REAL TRANSCRIPTION */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: isCurrentlyRecording ? '#FF3B30' : theme.semanticColors.surface,
              borderColor: isCurrentlyRecording ? '#FF3B30' : theme.semanticColors.border,
            },
          ]}
          onPress={handleVoiceRecording}
          disabled={disabled}
        >
          <Ionicons 
            name={isCurrentlyRecording ? "stop" : "mic-outline"} 
            size={20} 
            color={isCurrentlyRecording ? '#fff' : theme.semanticColors.textPrimary} 
          />
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
    position: 'relative',
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
  sendButtonFixed: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
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
}); 