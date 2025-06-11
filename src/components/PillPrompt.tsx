import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface PillPromptProps {
  text: string;
  onPress: () => void;
  delay?: number;
  disabled?: boolean;
}

export const PillPrompt: React.FC<PillPromptProps> = ({ 
  text, 
  onPress, 
  delay = 0,
  disabled = false 
}) => {
  const { theme, isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Spring motion animation on load
    const animationSequence = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(animatedValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 7,
        })
      ])
    ]);

    animationSequence.start();
  }, [animatedValue, scaleValue, delay]);

  const handlePress = () => {
    if (disabled) return;
    
    // Subtle press animation
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      })
    ]).start();

    onPress();
  };

  const pillStyle = [
    styles.pill,
    {
      backgroundColor: isDark ? theme.colors.jet : '#F5F5F5',
      borderColor: theme.semanticColors.border,
      opacity: disabled ? 0.5 : 1,
    }
  ];

  const textStyle = [
    styles.text,
    {
      color: theme.semanticColors.textPrimary,
    }
  ];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: animatedValue,
          transform: [
            { scale: scaleValue },
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }
          ]
        }
      ]}
    >
      <TouchableOpacity
        style={pillStyle}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={textStyle}>{text}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});