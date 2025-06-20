import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';

interface ComposerProps {
  onSend: (message: string) => void;
  onFileAttach?: (fileUrl: string, fileName: string, fileType: string) => void;
  onUpload?: () => void;
  onVoiceNote?: () => void;
  placeholder?: string;
  disabled?: boolean;
  sessionId?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onFileAttach,
  onUpload,
  onVoiceNote,
  placeholder = "What's on your mind?",
  disabled = false,
  sessionId,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  const handleFileUpload = async () => {
    if (!user?.id || isUploading) return;
    
    // If no sessionId, warn user that file will start a new conversation
    if (!sessionId) {
      Alert.alert(
        'Start New Conversation', 
        'Uploading a file will start a new conversation. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => performFileUpload() }
        ]
      );
      return;
    }
    
    performFileUpload();
  };

  const performFileUpload = async () => {

    try {
      setIsUploading(true);
      
      // Pick document
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
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
      
      // Validate file size (5MB limit)
      if (file.size && file.size > 5 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a file smaller than 5MB.');
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.mimeType || '')) {
        Alert.alert('Invalid File Type', 'Please select a PDF, JPG, or PNG file.');
        return;
      }

      // If no sessionId, just pass file info to parent component to handle
      if (!sessionId) {
        if (onFileAttach) {
          // For local file URL, we can use the file URI directly
          onFileAttach(file.uri, file.name, file.mimeType || 'application/octet-stream');
        }
        return;
      }

      // Create file path for storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${sessionId}/${Date.now()}.${fileExt}`;

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
          user_id: user.id,
          session_id: sessionId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.mimeType,
        });

      if (dbError) {
        throw dbError;
      }

      // Notify parent component
      if (onFileAttach) {
        onFileAttach(publicUrl, file.name, file.mimeType || 'application/octet-stream');
      }

      Alert.alert('Success', 'File uploaded successfully!');
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
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
            name="attach-outline" 
            size={20} 
            color={isUploading ? theme.semanticColors.textSecondary : theme.semanticColors.textPrimary} 
          />
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
          <Ionicons 
            name="mic-outline" 
            size={20} 
            color={theme.semanticColors.textPrimary} 
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
}); 