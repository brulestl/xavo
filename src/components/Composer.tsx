import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard, Alert, Pressable, Text, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { fileAnalysisService, AnalyzedFile } from '../services/fileAnalysisService';
import { AttachmentMenu } from './AttachmentMenu';
import { FilePreview } from './FilePreview';
import { monitoring } from '../services/monitoring';

// Safely import constants
let Constants: any = null;
try {
  Constants = require('expo-constants').default;
} catch (error) {
  console.warn('⚠️ expo-constants not available:', error);
}

// Add this constant at the top after imports
const IS_EXPO_GO = __DEV__ && !Constants.appOwnership;

interface ComposerProps {
  onSend: (message: string, attachments?: AnalyzedFile[]) => void;
  placeholder?: string;
  disabled?: boolean;
  sessionId?: string;
  isRecording?: boolean;
  liveTranscription?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
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
  const [attachedFiles, setAttachedFiles] = useState<AnalyzedFile[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [localLiveTranscription, setLocalLiveTranscription] = useState('');
  const focusAnim = useRef(new Animated.Value(0)).current;
  const textInputRef = useRef<TextInput>(null);

  // Use live transcription if provided, otherwise use message state
  const displayText = liveTranscription || localLiveTranscription || message;
  const isCurrentlyRecording = isRecording || false;

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
    if ((textToSend.trim() || attachedFiles.length > 0) && !disabled) {
      onSend(textToSend.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
      setMessage('');
      setLocalLiveTranscription('');
      setAttachedFiles([]);
      Keyboard.dismiss();
    }
  };

  // Voice recording disabled for now
  const handleVoiceRecording = () => {
    if (disabled) return;
    
    Alert.alert(
      'Voice Recording', 
      'Voice recording feature will be available in the next update.',
      [{ text: 'OK' }]
    );
  };

  // Camera photo capture
  const handleTakePhoto = async () => {
    if (disabled) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleFileSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Camera Error', 'Failed to open camera. Please try again.');
    }
  };

  // Photo library picker
  const handleChoosePhoto = async () => {
    if (disabled) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Photo library permission is needed to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleFileSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Photo picker error:', error);
      Alert.alert('Photo Error', 'Failed to open photo library. Please try again.');
    }
  };

  // Document picker
  const handleChooseFile = async () => {
    if (disabled) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'text/plain', 'text/csv'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets[0]) {
        await handleFileSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('File Error', 'Failed to select file. Please try again.');
    }
  };

  // Handle selected file (from camera, photos, or documents)
  const handleFileSelected = async (file: any) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to upload files.');
      return;
    }

    // Validate file
    const validation = fileAnalysisService.validateFile(file);
    if (!validation.valid) {
      Alert.alert('Invalid File', validation.error || 'File validation failed.');
      return;
    }

    try {
      // Create temporary file entry
      const tempFile: AnalyzedFile = {
        id: `temp_${Date.now()}`,
        name: file.name || 'Untitled',
        type: file.mimeType || file.type || 'application/octet-stream',
        size: file.size || 0,
        uri: file.uri,
        uploadProgress: 0,
        isAnalyzing: false,
      };

      // Add to attachments immediately
      setAttachedFiles(prev => [...prev, tempFile]);

      // Upload and analyze
      const analyzedFile = await fileAnalysisService.uploadAndAnalyze(
        file,
        user.id,
        sessionId,
        (progress) => {
          setAttachedFiles(prev => 
            prev.map(f => f.id === tempFile.id ? { ...f, uploadProgress: progress } : f)
          );
        },
        () => {
          setAttachedFiles(prev => 
            prev.map(f => f.id === tempFile.id ? { ...f, isAnalyzing: true } : f)
          );
        },
        (result) => {
          setAttachedFiles(prev => 
            prev.map(f => f.id === tempFile.id ? result : f)
          );
        }
      );

      // Final update
      setAttachedFiles(prev => 
        prev.map(f => f.id === tempFile.id ? analyzedFile : f)
      );

    } catch (error) {
      console.error('File processing error:', error);
      // Remove failed upload
      setAttachedFiles(prev => prev.filter(f => f.id !== tempFile.id));
      Alert.alert('Upload Failed', 'Failed to process file. Please try again.');
    }
  };

  // Remove file attachment
  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.semanticColors.border, theme.semanticColors.primary],
  });

  return (
    <View style={styles.container}>
      {/* File Attachments Preview */}
      {attachedFiles.length > 0 && (
        <ScrollView 
          horizontal 
          style={styles.attachmentsContainer}
          showsHorizontalScrollIndicator={false}
        >
          {attachedFiles.map((file) => (
            <View key={file.id} style={styles.attachmentWrapper}>
              <FilePreview
                file={file}
                onRemove={() => handleRemoveFile(file.id)}
                compact
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Text Input Area */}
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
                paddingRight: 45, // Space for send button
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
          
          {/* Send Button */}
          {(displayText.trim().length > 0 || attachedFiles.length > 0) && (
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
            },
          ]}
          onPress={() => setShowAttachmentMenu(true)}
          disabled={disabled}
        >
          <Ionicons 
            name="attach-outline" 
            size={20} 
            color={theme.semanticColors.textPrimary} 
          />
        </TouchableOpacity>

        {/* Voice Recording Button */}
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

      {/* Attachment Menu */}
      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onTakePhoto={handleTakePhoto}
        onChoosePhoto={handleChoosePhoto}
        onChooseFile={handleChooseFile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachmentsContainer: {
    marginBottom: 12,
    maxHeight: 120,
  },
  attachmentWrapper: {
    marginRight: 8,
    width: 200,
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