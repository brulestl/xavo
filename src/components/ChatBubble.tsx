import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  ViewStyle, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ActivityIndicator,
  Linking,
  Image
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { MessageActionMenu } from './MessageActionMenu';
import { ChatMessage } from './ChatMessage';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  messageId: string;
  conversationId: string;
  timestamp?: string;
  animatedValue?: Animated.Value;
  onEditMessage?: (messageId: string, newContent: string) => Promise<boolean>;
  isStreaming?: boolean;
  // File message support
  type?: 'text' | 'file' | 'text_with_file';
  filename?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  status?: 'uploading' | 'processing' | 'processed' | 'querying' | 'sent' | 'failed';
  metadata?: any;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isUser, 
  messageId,
  conversationId,
  timestamp,
  animatedValue = new Animated.Value(1),
  onEditMessage,
  isStreaming = false,
  type = 'text',
  filename,
  fileUrl,
  fileSize,
  fileType,
  status = 'sent',
  metadata
}) => {
  const { theme, isDark } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message);
  const [isSaving, setIsSaving] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef<TextInput>(null);
  const bubbleRef = useRef<View>(null);

  const dynamicBubbleStyle: ViewStyle = {
    backgroundColor: isUser 
      ? theme.getUserBubbleColor()
      : theme.getAssistantBubbleColor(),
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    shadowColor: theme.semanticColors.shadow,
  };

  const bubbleStyle = [
    styles.bubble,
    dynamicBubbleStyle,
    isUser ? styles.userBubble : styles.assistantBubble,
    isEditing && styles.editingBubble
  ];

  const textStyle = [
    styles.messageText,
    {
      color: isUser 
        ? theme.getUserMessageTextColor()
        : theme.semanticColors.textPrimary
    }
  ];

  const handleLongPress = (event: any) => {
    if (isEditing || isStreaming) return;
    
    // Get the position of the touch
    bubbleRef.current?.measure((x, y, width, height, pageX, pageY) => {
      setMenuPosition({
        x: pageX + width / 2, // Center horizontally on the bubble
        y: pageY // Top of the bubble
      });
      setShowActionMenu(true);
    });
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(message);
      // Success feedback is handled by the MessageActionMenu
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      throw error; // Let MessageActionMenu handle the error
    }
  };

  const handleEdit = () => {
    if (!onEditMessage || !isUser || isStreaming) return;
    
    setIsEditing(true);
    setEditedText(message);
    // Focus the input after a brief delay to ensure it's rendered
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSave = async () => {
    if (!editedText.trim()) {
      Alert.alert('Error', 'Message cannot be empty');
      return;
    }

    if (editedText.trim() === message.trim()) {
      // No changes made
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    
    try {
      if (onEditMessage) {
        console.log('💾 [ChatBubble] Starting save operation...');
        await onEditMessage(messageId, editedText.trim());
        console.log('✅ [ChatBubble] Save operation completed');
      }
      setIsEditing(false);
    } catch (error) {
      console.error('❌ [ChatBubble] Failed to update message:', error);
      Alert.alert('Error', 'Failed to update message. Please try again.');
      // Reset to original text
      setEditedText(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedText(message);
    setIsEditing(false);
  };

  const handleFilePress = async () => {
    if (fileUrl && status === 'sent') {
      try {
        const supported = await Linking.canOpenURL(fileUrl);
        if (supported) {
          await Linking.openURL(fileUrl);
        } else {
          Alert.alert('Cannot open file', 'No app available to open this file type');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to open file');
        console.error('File open error:', error);
      }
    }
  };

  const getFileIcon = () => {
    if (!fileType) return 'document-outline';
    
    if (fileType.includes('pdf')) return 'document-text-outline';
    if (fileType.includes('image')) return 'image-outline';
    if (fileType.includes('word') || fileType.includes('document')) return 'document-outline';
    if (fileType.includes('text')) return 'document-text-outline';
    return 'attach-outline';
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render file message
  const renderFileContent = () => {
    // Show inline image thumbnail for image files
    if (fileType?.startsWith('image/') && fileUrl) {
      return (
        <View style={styles.imagePreviewContainer}>
          <Image
            source={{ uri: fileUrl }}
            style={{ width: 120, height: 120, borderRadius: 8 }}
            resizeMode="cover"
          />
          {(status === 'uploading' || status === 'processing') && (
            <View style={styles.statusOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </View>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.fileContainer}
        onPress={handleFilePress}
        disabled={status !== 'sent'}
      >
        <View style={styles.fileIconContainer}>
          <Ionicons 
            name={getFileIcon()} 
            size={24} 
            color={isUser ? '#FFFFFF' : theme.semanticColors.primary} 
          />
          {(status === 'uploading' || status === 'processing') && (
            <View style={styles.statusOverlay}>
              <ActivityIndicator 
                size="small" 
                color={isUser ? '#FFFFFF' : theme.semanticColors.primary} 
              />
            </View>
          )}
          {status === 'failed' && (
            <View style={styles.statusOverlay}>
              <Ionicons 
                name="warning-outline" 
                size={16} 
                color="#FF3B30" 
              />
            </View>
          )}
        </View>
        
        <View style={styles.fileDetails}>
          <Text 
            style={[
              styles.filename, 
              { 
                color: isUser ? '#FFFFFF' : theme.semanticColors.textPrimary,
                opacity: status === 'failed' ? 0.6 : 1
              }
            ]}
            numberOfLines={2}
          >
            {filename || 'Unknown file'}
          </Text>
          <Text 
            style={[
              styles.fileMetadata, 
              { 
                color: isUser ? 'rgba(255,255,255,0.7)' : theme.semanticColors.textSecondary,
                opacity: status === 'failed' ? 0.6 : 1
              }
            ]}
          >
            {formatFileSize(fileSize)}
            {status === 'uploading' && ' • Uploading...'}
            {status === 'processing' && ' • Processing...'}
            {status === 'processed' && ' • Processed'}
            {status === 'querying' && ' • Querying...'}
            {status === 'failed' && ' • Upload failed'}
          </Text>
        </View>

        {status === 'sent' && (
          <Ionicons 
            name="chevron-forward" 
            size={16} 
            color={isUser ? 'rgba(255,255,255,0.5)' : theme.semanticColors.textSecondary} 
          />
        )}
      </TouchableOpacity>
    );
  };

  // Render text with attached file content
  const renderTextWithFileContent = () => {
    const attachmentInfo = metadata?.attachmentInfo;
    if (!attachmentInfo) {
      // Fallback to regular text if no attachment info
      return <ChatMessage text={message} isUserMessage={isUser} />;
    }

    const handleAttachedFilePress = async () => {
      if (attachmentInfo.fileUrl && attachmentInfo.status === 'sent') {
        try {
          const supported = await Linking.canOpenURL(attachmentInfo.fileUrl);
          if (supported) {
            await Linking.openURL(attachmentInfo.fileUrl);
          } else {
            Alert.alert('Cannot open file', 'No app available to open this file type');
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to open file');
          console.error('File open error:', error);
        }
      }
    };

    const getAttachedFileIcon = () => {
      const fileType = attachmentInfo.fileType;
      if (!fileType) return 'document-outline';
      
      if (fileType.includes('pdf')) return 'document-text-outline';
      if (fileType.includes('image')) return 'image-outline';
      if (fileType.includes('word') || fileType.includes('document')) return 'document-outline';
      if (fileType.includes('text')) return 'document-text-outline';
      return 'attach-outline';
    };

    return (
      <View style={styles.textWithFileContainer}>
        {/* Text Content */}
        <View style={styles.textContent}>
          <ChatMessage text={message} isUserMessage={isUser} />
        </View>
        
        {/* File Attachment */}
        <TouchableOpacity 
          style={[
            styles.attachedFileContainer,
            {
              backgroundColor: isUser 
                ? 'rgba(255,255,255,0.15)' 
                : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
              borderColor: isUser 
                ? 'rgba(255,255,255,0.3)' 
                : theme.semanticColors.border
            }
          ]}
          onPress={handleAttachedFilePress}
          disabled={attachmentInfo.status !== 'sent'}
        >
          <View style={styles.attachedFileIcon}>
            <Ionicons 
              name={getAttachedFileIcon()} 
              size={20} 
              color={isUser ? 'rgba(255,255,255,0.8)' : theme.semanticColors.primary} 
            />
          </View>
          
          <View style={styles.attachedFileDetails}>
            <Text 
              style={[
                styles.attachedFilename, 
                { 
                  color: isUser ? 'rgba(255,255,255,0.9)' : theme.semanticColors.textPrimary
                }
              ]}
              numberOfLines={1}
            >
              📎 {attachmentInfo.filename}
            </Text>
            <Text 
              style={[
                styles.attachedFileSize, 
                { 
                  color: isUser ? 'rgba(255,255,255,0.7)' : theme.semanticColors.textSecondary
                }
              ]}
            >
              {formatFileSize(attachmentInfo.fileSize)}
            </Text>
          </View>

          {attachmentInfo.status === 'sent' && (
            <Ionicons 
              name="download-outline" 
              size={16} 
              color={isUser ? 'rgba(255,255,255,0.5)' : theme.semanticColors.textSecondary} 
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (isEditing) {
    return (
      <Animated.View 
        ref={bubbleRef}
        style={[
          styles.container,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              })
            }]
          }
        ]}
      >
        <View style={bubbleStyle}>
          <TextInput
            ref={inputRef}
            style={[
              styles.editInput,
              {
                color: isUser ? '#FFFFFF' : theme.semanticColors.textPrimary,
                borderColor: isSaving ? theme.semanticColors.accent : theme.semanticColors.border,
                opacity: isSaving ? 0.7 : 1,
              }
            ]}
            value={editedText}
            onChangeText={setEditedText}
            multiline
            selectTextOnFocus
            autoFocus
            editable={!isSaving}
            placeholder="Enter message..."
            placeholderTextColor={isUser ? 'rgba(255,255,255,0.6)' : theme.semanticColors.textSecondary}
          />
          
          <View style={styles.editButtons}>
            <TouchableOpacity 
              style={[
                styles.editButton, 
                styles.cancelButton, 
                { 
                  borderColor: theme.semanticColors.border,
                  opacity: isSaving ? 0.5 : 1 
                }
              ]}
              onPress={handleCancel}
              disabled={isSaving}
            >
              <Ionicons 
                name="close" 
                size={16} 
                color={isSaving ? theme.semanticColors.textSecondary : (isUser ? '#FFFFFF' : theme.semanticColors.textSecondary)} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.editButton, 
                styles.saveButton, 
                { 
                  backgroundColor: isSaving ? theme.semanticColors.textSecondary : theme.semanticColors.accent,
                  opacity: isSaving ? 0.8 : 1 
                }
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator 
                  size="small" 
                  color="#FFFFFF" 
                />
              ) : (
                <Ionicons 
                  name="checkmark" 
                  size={16} 
                  color="#FFFFFF" 
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View 
        ref={bubbleRef}
        style={[
          styles.container,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              })
            }]
          }
        ]}
      >
        <TouchableOpacity
          style={bubbleStyle}
          onLongPress={handleLongPress}
          delayLongPress={500}
          activeOpacity={0.8}
        >
          {type === 'file' ? renderFileContent() : type === 'text_with_file' ? renderTextWithFileContent() : <ChatMessage text={message} isUserMessage={isUser} />}
        </TouchableOpacity>
      </Animated.View>

      {/* Message Action Menu */}
      <MessageActionMenu
        visible={showActionMenu}
        onClose={() => setShowActionMenu(false)}
        onCopy={handleCopy}
        onEdit={isUser && onEditMessage ? handleEdit : undefined}
        isUserMessage={isUser}
        anchorPosition={menuPosition}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  userBubble: {
    marginLeft: 40,
  },
  assistantBubble: {
    marginRight: 40,
  },
  editingBubble: {
    paddingBottom: 50, // Make room for edit buttons
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  editInput: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 22,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    borderWidth: 0,
  },
  // File message styles
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fileIconContainer: {
    marginRight: 12,
    position: 'relative',
  },
  statusOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
    marginRight: 8,
  },
  filename: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  fileMetadata: {
    fontSize: 12,
    opacity: 0.8,
  },
  textWithFileContainer: {
    flexDirection: 'column',
  },
  textContent: {
    marginBottom: 12,
  },
  attachedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
  },
  attachedFileIcon: {
    marginRight: 8,
  },
  attachedFileDetails: {
    flex: 1,
  },
  attachedFilename: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  attachedFileSize: {
    fontSize: 12,
    opacity: 0.8,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginVertical: 4,
  },
});