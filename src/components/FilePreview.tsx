import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { AnalyzedFile } from '../services/fileAnalysisService';

interface FilePreviewProps {
  file: AnalyzedFile;
  onRemove?: () => void;
  compact?: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  compact = false,
}) => {
  const { theme } = useTheme();
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Safe file type checking with null guards
  const fileType = file.type || '';
  const isImage = fileType.startsWith('image/');
  const isPDF = fileType === 'application/pdf';
  const isText = fileType.startsWith('text/');

  const getFileIcon = () => {
    if (isImage) return 'image-outline';
    if (isPDF) return 'document-text-outline';
    if (isText) return 'document-outline';
    return 'document-outline';
  };

  const getFileColor = () => {
    if (isImage) return '#4CAF50';
    if (isPDF) return '#F44336';
    if (isText) return '#2196F3';
    return '#757575';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileSizeDisplay = (file: AnalyzedFile) => {
    // Use safe file type checking
    const safeFileType = file.type || '';
    const isImage = safeFileType.startsWith('image/');
    
    // For images with no size info, show a more appropriate message
    if (isImage && (file.size === 0 || file.size === undefined)) {
      return 'Image file';
    }
    
    // For non-images or images with valid size, show the actual size
    return formatFileSize(file.size);
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: theme.semanticColors.surface, borderColor: theme.semanticColors.border }]}>
        <View style={styles.compactContent}>
          <View style={[styles.fileIconContainer, { backgroundColor: getFileColor() + '20' }]}>
            <Ionicons name={getFileIcon() as any} size={16} color={getFileColor()} />
          </View>
          
          <View style={styles.compactFileInfo}>
            <Text style={[styles.compactFileName, { color: theme.semanticColors.textPrimary }]} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={[styles.compactFileSize, { color: theme.semanticColors.textSecondary }]}>
              {getFileSizeDisplay(file)}
            </Text>
          </View>

          {file.isAnalyzing && (
            <ActivityIndicator size="small" color={theme.semanticColors.primary} />
          )}

          {onRemove && (
            <TouchableOpacity onPress={onRemove} style={styles.compactRemoveButton}>
              <Ionicons name="close-circle" size={20} color={theme.semanticColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.semanticColors.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: theme.semanticColors.primary,
                    width: `${file.uploadProgress}%`
                  }
                ]} 
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.surface, borderColor: theme.semanticColors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.fileInfo}>
          {isImage && file.publicUrl && !imageError ? (
            <Image
              source={{ uri: file.publicUrl }}
              style={styles.thumbnail}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.iconContainer, { backgroundColor: getFileColor() + '20' }]}>
              <Ionicons name={getFileIcon() as any} size={24} color={getFileColor()} />
            </View>
          )}
          
          <View style={styles.fileDetails}>
            <Text style={[styles.fileName, { color: theme.semanticColors.textPrimary }]} numberOfLines={2}>
              {file.name}
            </Text>
            <Text style={[styles.fileSize, { color: theme.semanticColors.textSecondary }]}>
              {getFileSizeDisplay(file)}
            </Text>
            
            {file.isAnalyzing && (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="small" color={theme.semanticColors.primary} />
                <Text style={[styles.analyzingText, { color: theme.semanticColors.primary }]}>
                  {file.isRAGDocument ? 'Processing document...' : 'Analyzing with AI...'}
                </Text>
              </View>
            )}
            
            {file.isRAGDocument && !file.isAnalyzing && !file.error && (
              <View style={styles.analyzingContainer}>
                <Ionicons name="document-text-outline" size={16} color={theme.semanticColors.primary} />
                <Text style={[styles.analyzingText, { color: theme.semanticColors.primary }]}>
                  Ready to process
                </Text>
              </View>
            )}
            
            {file.error && (
              <View style={styles.errorContainer}>
                <Ionicons name="warning-outline" size={16} color="#F44336" />
                <Text style={styles.errorText}>{file.error}</Text>
              </View>
            )}
          </View>
        </View>

        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <Ionicons name="close-circle-outline" size={24} color={theme.semanticColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.semanticColors.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: theme.semanticColors.primary,
                  width: `${file.uploadProgress}%`
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: theme.semanticColors.textSecondary }]}>
            {Math.round(file.uploadProgress)}%
          </Text>
        </View>
      )}

      {/* Analysis Results */}
      {file.analysis && !file.isAnalyzing && (
        <View style={[styles.analysisContainer, { borderTopColor: theme.semanticColors.border }]}>
          <Text style={[styles.analysisTitle, { color: theme.semanticColors.textPrimary }]}>
            🤖 AI Analysis
          </Text>
          
          <Text style={[styles.analysisText, { color: theme.semanticColors.textPrimary }]} numberOfLines={3}>
            {file.analysis.summary}
          </Text>
          
          {file.analysis.keyPoints.length > 0 && (
            <View style={styles.keyPointsContainer}>
              <Text style={[styles.keyPointsTitle, { color: theme.semanticColors.textSecondary }]}>
                Key Points:
              </Text>
              {file.analysis.keyPoints.slice(0, 2).map((point, index) => (
                <Text key={index} style={[styles.keyPoint, { color: theme.semanticColors.textPrimary }]}>
                  • {point}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity 
            onPress={() => setShowFullAnalysis(true)}
            style={[styles.viewMoreButton, { backgroundColor: theme.semanticColors.primary + '10' }]}
          >
            <Text style={[styles.viewMoreText, { color: theme.semanticColors.primary }]}>
              View Complete Analysis
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full Analysis Modal */}
      <Modal visible={showFullAnalysis} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.semanticColors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.semanticColors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.semanticColors.textPrimary }]}>
              Complete AI Analysis
            </Text>
            <TouchableOpacity onPress={() => setShowFullAnalysis(false)}>
              <Ionicons name="close" size={24} color={theme.semanticColors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {file.analysis && (
              <View style={styles.fullAnalysisContent}>
                <Text style={[styles.fullAnalysisText, { color: theme.semanticColors.textPrimary }]}>
                  {file.analysis.aiResponse}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
    overflow: 'hidden',
  },
  compactContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  compactFileInfo: {
    flex: 1,
    marginLeft: 8,
  },
  compactFileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  compactFileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  compactRemoveButton: {
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  fileInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    marginBottom: 8,
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyzingText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginLeft: 4,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    marginLeft: 8,
    minWidth: 30,
  },
  analysisContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  keyPointsContainer: {
    marginBottom: 12,
  },
  keyPointsTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  keyPoint: {
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 8,
    marginBottom: 2,
  },
  viewMoreButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  fullAnalysisContent: {
    padding: 16,
  },
  fullAnalysisText: {
    fontSize: 16,
    lineHeight: 24,
  },
}); 