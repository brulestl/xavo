import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { supabaseFileService } from '../services/supabaseFileService';

interface FileMessageBubbleProps {
  message: {
    id: string;
    content: string;
    filename?: string;
    fileUrl?: string;
    fileSize?: number;
    fileType?: string;
    status?: 'uploading' | 'processing' | 'processed' | 'querying' | 'sent' | 'failed';
    metadata?: {
      fileId?: string;
      description?: string;
    };
    error?: string;
  };
  sessionId: string;
  onRetrySuccess?: (fileId: string, description: string) => void;
  onQueryFile?: (fileId: string, filename: string, question: string) => void;
}

export const FileMessageBubble: React.FC<FileMessageBubbleProps> = ({
  message,
  sessionId,
  onRetrySuccess,
  onQueryFile,
}) => {
  const { theme } = useTheme();
  const [isRetrying, setIsRetrying] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isImage = message.fileType?.startsWith('image/');
  const isPDF = message.fileType === 'application/pdf';
  const isDocument = message.fileType?.includes('document') || message.fileType?.includes('text');

  const getFileIcon = () => {
    if (isImage) return 'image-outline';
    if (isPDF) return 'document-text-outline';
    if (isDocument) return 'document-outline';
    return 'attach-outline';
  };

  const getFileColor = () => {
    if (isImage) return '#4CAF50';
    if (isPDF) return '#F44336';
    if (isDocument) return '#2196F3';
    return '#757575';
  };

  const getStatusColor = () => {
    switch (message.status) {
      case 'processed': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'processing':
      case 'uploading': return theme.semanticColors.primary;
      default: return theme.semanticColors.textSecondary;
    }
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'processed': return 'checkmark-circle-outline';
      case 'failed': return 'alert-circle-outline';
      case 'processing': return 'cog-outline';
      case 'uploading': return 'cloud-upload-outline';
      default: return 'document-outline';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleRetryProcessing = async () => {
    if (!message.metadata?.fileId) {
      Alert.alert('Error', 'Cannot retry - file ID not found');
      return;
    }

    setIsRetrying(true);
    try {
      const result = await supabaseFileService.retryFileProcessing(
        message.metadata.fileId,
        sessionId,
        (progress) => {
          console.log(`Retry progress: ${progress.stage} - ${progress.message}`);
        }
      );

      if (result.success) {
        onRetrySuccess?.(result.fileId, result.description);
        Alert.alert('Success', 'File processed successfully!');
      } else {
        throw new Error(result.error || 'Retry failed');
      }
    } catch (error) {
      console.error('Retry error:', error);
      Alert.alert('Retry Failed', 'Failed to reprocess file. Please try again.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleFilePress = async () => {
    if (message.status === 'processed' && message.metadata?.fileId) {
      // Allow user to query the processed file
      Alert.prompt(
        'Ask about this file',
        `What would you like to know about ${message.filename}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Ask', 
            onPress: (question) => {
              if (question && question.trim() && message.metadata?.fileId) {
                onQueryFile?.(message.metadata.fileId, message.filename || 'file', question.trim());
              }
            }
          }
        ],
        'plain-text',
        '',
        'default'
      );
    } else if (message.fileUrl) {
      // Try to open the file
      try {
        const supported = await Linking.canOpenURL(message.fileUrl);
        if (supported) {
          await Linking.openURL(message.fileUrl);
        } else {
          Alert.alert('Cannot open file', 'No app available to open this file type');
        }
      } catch (error) {
        console.error('Error opening file:', error);
        Alert.alert('Error', 'Failed to open file');
      }
    }
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.semanticColors.surface,
        borderColor: theme.semanticColors.border,
      }
    ]}>
      {/* File Header */}
      <TouchableOpacity
        style={styles.fileHeader}
        onPress={handleFilePress}
        disabled={message.status === 'uploading' || message.status === 'processing'}
      >
        {/* File Icon/Thumbnail */}
        <View style={styles.fileIconContainer}>
          {isImage && message.fileUrl && !imageError ? (
            <Image
              source={{ uri: message.fileUrl }}
              style={styles.thumbnail}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[
              styles.iconWrapper,
              { backgroundColor: getFileColor() + '20' }
            ]}>
              <Ionicons
                name={getFileIcon() as any}
                size={24}
                color={getFileColor()}
              />
            </View>
          )}
        </View>

        {/* File Details */}
        <View style={styles.fileDetails}>
          <Text style={[
            styles.filename,
            { color: theme.semanticColors.textPrimary }
          ]} numberOfLines={2}>
            {message.filename || 'File'}
          </Text>
          
          {message.fileSize && (
            <Text style={[
              styles.fileSize,
              { color: theme.semanticColors.textSecondary }
            ]}>
              {formatFileSize(message.fileSize)}
            </Text>
          )}

          {/* Status Indicator */}
          <View style={styles.statusContainer}>
            {(message.status === 'processing' || message.status === 'uploading') ? (
              <ActivityIndicator size="small" color={getStatusColor()} />
            ) : (
              <Ionicons
                name={getStatusIcon() as any}
                size={16}
                color={getStatusColor()}
              />
            )}
            <Text style={[
              styles.statusText,
              { color: getStatusColor() }
            ]}>
              {message.status === 'uploading' ? 'Uploading...' :
               message.status === 'processing' ? 'Processing...' :
               message.status === 'processed' ? 'Ready for questions' :
               message.status === 'failed' ? 'Processing failed' :
               'Sent'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Vision Description */}
      {message.metadata?.description && (
        <View style={[
          styles.ocrContainer,
          { borderTopColor: theme.semanticColors.border }
        ]}>
          <Text style={[
            styles.ocrLabel,
            { color: theme.semanticColors.textSecondary }
          ]}>
            👁️ Analysis:
          </Text>
          <Text style={[
            styles.ocrText,
            { color: theme.semanticColors.textPrimary }
          ]} numberOfLines={3}>
            {message.metadata.description}
          </Text>
        </View>
      )}

      {/* Error State with Retry */}
      {message.status === 'failed' && (
        <View style={[
          styles.errorContainer,
          { borderTopColor: theme.semanticColors.border }
        ]}>
          <Text style={[
            styles.errorText,
            { color: '#F44336' }
          ]}>
            {message.error || 'Processing failed'}
          </Text>
          
          <TouchableOpacity
            style={[
              styles.retryButton,
              { backgroundColor: theme.semanticColors.primary }
            ]}
            onPress={handleRetryProcessing}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={styles.retryText}>Retry Processing</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Query Hint for Processed Files */}
      {message.status === 'processed' && (
        <View style={[
          styles.hintContainer,
          { borderTopColor: theme.semanticColors.border }
        ]}>
          <Text style={[
            styles.hintText,
            { color: theme.semanticColors.textSecondary }
          ]}>
            💡 Tap to ask questions about this file
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
  },
  fileHeader: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  fileIconContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
  },
  filename: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    marginBottom: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  ocrContainer: {
    padding: 12,
    borderTopWidth: 1,
  },
  ocrLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  ocrText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorContainer: {
    padding: 12,
    borderTopWidth: 1,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  hintContainer: {
    padding: 8,
    borderTopWidth: 1,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 