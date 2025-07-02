import React, { useState, useRef, useEffect } from 'react';
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
import { 
  generateThumbnailUrl, 
  supportsThumbnail, 
  getFileTypeIcon, 
  getFileTypeColor, 
  formatFileSize 
} from '../utils/thumbnailUtils';

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
  // File query support
  onQueryFile?: (fileId: string, filename: string, question: string, sessionId: string) => void;
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
  metadata,
  onQueryFile
}) => {
  const { theme, isDark } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message);
  const [isSaving, setIsSaving] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [imageLoadError, setImageLoadError] = useState(false);
  const [processingOverlay, setProcessingOverlay] = useState<'spinner' | 'checkmark' | 'hidden'>('hidden');
  const inputRef = useRef<TextInput>(null);
  const bubbleRef = useRef<View>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Handle in-place processing indicator animations
  useEffect(() => {
    if (status === 'uploading' || status === 'processing') {
      setProcessingOverlay('spinner');
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (status === 'processed' || status === 'sent') {
      if (processingOverlay === 'spinner') {
        setProcessingOverlay('checkmark');
        // Show checkmark for 500ms, then fade out
        setTimeout(() => {
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setProcessingOverlay('hidden');
          });
        }, 500);
      }
    } else if (status === 'failed') {
      setProcessingOverlay('hidden');
      overlayOpacity.setValue(0);
    }
  }, [status, processingOverlay, overlayOpacity]);

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
    // If this is a processed file with metadata.fileId, offer query option
    if (metadata?.fileId && status === 'processed' && onQueryFile) {
      Alert.alert(
        'File Options',
        `What would you like to do with ${filename || 'this file'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Ask Question', 
            onPress: () => {
              Alert.prompt(
                'Ask about this file',
                `What would you like to know about ${filename || 'this file'}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Ask', 
                    onPress: (question) => {
                      if (question && question.trim() && metadata?.fileId) {
                        onQueryFile(metadata.fileId, filename || 'file', question.trim(), conversationId);
                      }
                    }
                  }
                ],
                'plain-text',
                '',
                'default'
              );
            }
          },
          ...(fileUrl ? [{ 
            text: 'Open File', 
            onPress: async () => {
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
          }] : [])
        ]
      );
    } else if (fileUrl && status === 'sent') {
      // Fallback to just opening the file
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

  // Render real 128×128 thumbnail with processing overlay
  const renderThumbnailWithOverlay = (imageUrl: string, fileType: string) => {
    const thumbnailUrl = supportsThumbnail(fileType) ? generateThumbnailUrl(imageUrl) : null;
    
    return (
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl && !imageLoadError ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.realThumbnail}
            onError={() => setImageLoadError(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={[
            styles.iconThumbnail,
            { backgroundColor: getFileTypeColor(fileType) + '20' }
          ]}>
            <Ionicons 
              name={getFileTypeIcon(fileType) as any} 
              size={24} 
              color={getFileTypeColor(fileType)} 
            />
          </View>
        )}
        
        {/* In-place processing overlay */}
        {processingOverlay !== 'hidden' && (
          <Animated.View 
            style={[
              styles.processingOverlay,
              { opacity: overlayOpacity }
            ]}
          >
            {processingOverlay === 'spinner' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </Animated.View>
        )}
      </View>
    );
  };

  // Render single unified bubble - ALWAYS text + optional 64×64 thumbnail
  const renderUnifiedContent = () => {
    const hasFileAttachment = metadata?.hasAttachment || metadata?.file_url || fileUrl;
    const attachmentFileUrl = metadata?.file_url || fileUrl;
    const attachmentFileType = metadata?.fileType || fileType;
    const isImageAttachment = attachmentFileType?.startsWith('image/');
    
    return (
      <View style={styles.textWithThumbnailContainer}>
        {/* Main text content - ALWAYS present */}
        <View style={styles.textContent}>
          <ChatMessage text={message} isUserMessage={isUser} />
        </View>
        
        {/* Compact 64×64 thumbnail attachment */}
        {hasFileAttachment && attachmentFileUrl && attachmentFileType && (
          <TouchableOpacity 
            style={styles.inlineThumbnailContainer}
            onPress={handleFilePress}
            disabled={!metadata?.fileId && !fileUrl}
          >
            {renderThumbnailWithOverlay(attachmentFileUrl, attachmentFileType)}
            
            {/* Only show file details for non-image attachments */}
            {!isImageAttachment && (
              <View style={styles.thumbnailFileDetails}>
                <Text 
                  style={[
                    styles.thumbnailFilename, 
                    { color: isUser ? 'rgba(255,255,255,0.9)' : theme.semanticColors.textPrimary }
                  ]}
                  numberOfLines={1}
                >
                  📎 {filename || metadata?.attachmentInfo?.filename || 'File'}
                </Text>
                <Text 
                  style={[
                    styles.thumbnailFileSize, 
                    { color: isUser ? 'rgba(255,255,255,0.7)' : theme.semanticColors.textSecondary }
                  ]}
                >
                  {fileSize ? formatFileSize(fileSize) : (metadata?.attachmentInfo?.fileSize ? formatFileSize(metadata.attachmentInfo.fileSize) : '')}
                </Text>
              </View>
            )}
            
            {/* Show interactive hint for processed files */}
            {metadata?.fileId && status === 'processed' && (
              <View style={styles.queryHintContainer}>
                <Text style={[
                  styles.queryHintText,
                  { color: isUser ? 'rgba(255,255,255,0.8)' : theme.semanticColors.textSecondary }
                ]}>
                  💡 Tap to ask questions
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
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
          {renderUnifiedContent()}
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
  // Compact 64×64 thumbnail styles for unified content
  thumbnailContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10,
  },
  realThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 6,
  },
  iconThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWithThumbnailContainer: {
    flexDirection: 'column',
  },
  inlineThumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  thumbnailFileDetails: {
    flex: 1,
    marginLeft: 8,
  },
  thumbnailFilename: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 1,
  },
  thumbnailFileSize: {
    fontSize: 11,
    opacity: 0.8,
  },
  queryHintContainer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  queryHintText: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});