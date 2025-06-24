import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface ProcessingNotificationProps {
  visible: boolean;
  message: string;
  progress?: number;
}

export const ProcessingNotification: React.FC<ProcessingNotificationProps> = ({
  visible,
  message,
  progress,
}) => {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.surface, borderColor: theme.semanticColors.border }]}>
      <View style={styles.content}>
        <ActivityIndicator 
          size="small" 
          color={theme.semanticColors.primary} 
          style={styles.spinner}
        />
        
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: theme.semanticColors.textPrimary }]}>
            {message}
          </Text>
          
          {progress !== undefined && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: theme.semanticColors.border }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      backgroundColor: theme.semanticColors.primary,
                      width: `${progress}%`
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: theme.semanticColors.textSecondary }]}>
                {Math.round(progress)}%
              </Text>
            </View>
          )}
        </View>
        
        <Ionicons 
          name="document-text-outline" 
          size={20} 
          color={theme.semanticColors.primary} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    minWidth: 35,
    textAlign: 'right',
  },
}); 