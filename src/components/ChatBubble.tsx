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
  ActivityIndicator
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
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isUser, 
  messageId,
  conversationId,
  timestamp,
  animatedValue = new Animated.Value(1),
  onEditMessage,
  isStreaming = false
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
      ? theme.semanticColors.primary 
      : (isDark ? '#2C2C2C' : '#F5F5F5'),
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
        ? '#FFFFFF' 
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
          <ChatMessage text={message} />
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
});