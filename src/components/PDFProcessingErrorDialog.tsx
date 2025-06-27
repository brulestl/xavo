import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface PDFProcessingErrorDialogProps {
  visible: boolean;
  fileName: string;
  onClose: () => void;
  onTryPasting: () => void;
}

export const PDFProcessingErrorDialog: React.FC<PDFProcessingErrorDialogProps> = ({
  visible,
  fileName,
  onClose,
  onTryPasting,
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.semanticColors.background }]}>
          {/* Header Icon */}
          <View style={[styles.iconContainer, { backgroundColor: '#FF9800' + '20' }]}>
            <Ionicons name="document-text-outline" size={32} color="#FF9800" />
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: theme.semanticColors.textPrimary }]}>
            Complex PDF Detected
          </Text>
          
          {/* Message */}
          <Text style={[styles.modalMessage, { color: theme.semanticColors.textSecondary }]}>
            {fileName ? `"${fileName}"` : 'This PDF'} has complex formatting that makes text extraction difficult.{'\n\n'}
            <Text style={{ fontWeight: '600', color: theme.semanticColors.textPrimary }}>
              For better results, try copying and pasting the content directly into your message.
            </Text>
          </Text>

          {/* Tips Section */}
          <View style={[styles.tipsContainer, { backgroundColor: theme.semanticColors.surface, borderColor: theme.semanticColors.border }]}>
            <Text style={[styles.tipsTitle, { color: theme.semanticColors.primary }]}>
              💡 Quick Tip
            </Text>
            <Text style={[styles.tipsText, { color: theme.semanticColors.textSecondary }]}>
              Open the PDF in your viewer, select the text you want to discuss, copy it, and paste it in your message instead.
            </Text>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { borderColor: theme.semanticColors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: theme.semanticColors.textSecondary }]}>
                Close
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, { backgroundColor: theme.semanticColors.primary }]}
              onPress={onTryPasting}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                Try Pasting
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  tipsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    // backgroundColor set dynamically
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 