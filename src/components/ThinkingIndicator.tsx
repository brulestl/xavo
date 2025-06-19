import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ThinkingIndicatorProps {
  visible: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ visible }) => {
  const { theme, isDark } = useTheme();

  if (!visible) return null;

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: isDark ? '#2C2C2C' : '#F5F5F5',
        shadowColor: theme.semanticColors.shadow 
      }
    ]}>
      <View style={styles.content}>
        <ActivityIndicator 
          size="small" 
          color={theme.semanticColors.primary} 
          style={styles.spinner}
        />
        <Text style={[
          styles.text, 
          { color: theme.semanticColors.textSecondary }
        ]}>
          Thinking...
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginVertical: 4,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    maxWidth: '80%',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontStyle: 'italic',
  },
}); 