import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface ThemeSwitchProps {
  style?: any;
}

export const ThemeSwitch: React.FC<ThemeSwitchProps> = ({ style }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const translateX = useRef(new Animated.Value(isDark ? 38 : 2)).current;

  // Animate switch position when theme changes
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isDark ? 38 : 2,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isDark, translateX]);

  const handleToggle = () => {
    // Animate to new position immediately for responsive feel
    Animated.timing(translateX, {
      toValue: !isDark ? 38 : 2,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    // Toggle theme
    toggleTheme();
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: theme.semanticColors.textSecondary }]}>
        Theme
      </Text>
      
      <TouchableOpacity
        style={[
          styles.switch,
          {
            backgroundColor: isDark ? theme.getUserBubbleColor() : theme.semanticColors.border,
            borderColor: theme.semanticColors.border,
          },
        ]}
        onPress={handleToggle}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.switchThumb,
            {
              backgroundColor: theme.semanticColors.background,
              transform: [{ translateX }],
            },
          ]}
        >
          <Ionicons
            name={isDark ? 'moon' : 'sunny'}
            size={16}
            color={isDark ? theme.getUserBubbleColor() : theme.getFileUploadBubbleColor()}
          />
        </Animated.View>
        
        <View style={styles.switchLabels}>
          <Text style={[styles.switchLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : theme.semanticColors.textPrimary }]}>
            Light
          </Text>
          <Text style={[styles.switchLabel, { color: isDark ? theme.semanticColors.textPrimary : 'rgba(0,0,0,0.4)' }]}>
            Dark
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 72,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    position: 'relative',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  switchThumb: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    top: 2,
  },
  switchLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    zIndex: -1,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
}); 