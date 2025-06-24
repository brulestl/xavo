import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ThinkingIndicatorProps {
  visible: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ visible }) => {
  const { theme, isDark } = useTheme();
  
  // Animated values for the dual spinners
  const spinValue1 = useRef(new Animated.Value(0)).current;
  const spinValue2 = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Fade in the entire component
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // First spinner - clockwise, 3 second duration
      const spin1 = Animated.loop(
        Animated.timing(spinValue1, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );

      // Second spinner - counter-clockwise, 2 second duration
      const spin2 = Animated.loop(
        Animated.timing(spinValue2, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );

      // Pulse animation for the gradient background
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      // Start all animations
      spin1.start();
      spin2.start();
      pulse.start();

      return () => {
        spin1.stop();
        spin2.stop();
        pulse.stop();
      };
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, spinValue1, spinValue2, pulseValue, fadeAnim]);

  if (!visible) return null;

  // Create rotation interpolations
  const spin1Rotation = spinValue1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin2Rotation = spinValue2.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'], // Counter-clockwise
  });

  // Dynamic colors based on theme
  const primaryColor = theme.semanticColors.primary || '#00FFFF';
  const pulseOpacity1 = pulseValue.interpolate({
    inputRange: [0.7, 1],
    outputRange: [0.1, 0.3],
  });
  const pulseOpacity2 = pulseValue.interpolate({
    inputRange: [0.7, 1],
    outputRange: [0.05, 0.15],
  });

  return (
    <Animated.View style={[
      styles.container, 
      { 
        backgroundColor: isDark ? '#2C2C2C' : '#F8F8F8',
        shadowColor: theme.semanticColors.shadow,
        opacity: fadeAnim,
      }
    ]}>
      <View style={styles.content}>
        {/* Spinner Container */}
        <View style={styles.spinnerContainer}>
          {/* Pulsing gradient background - simulated with multiple Views */}
          <Animated.View style={[
            styles.gradientBackground1,
            { 
              backgroundColor: primaryColor,
              opacity: pulseOpacity1,
            }
          ]} />
          <Animated.View style={[
            styles.gradientBackground2,
            { 
              backgroundColor: primaryColor,
              opacity: pulseOpacity2,
            }
          ]} />

          {/* First spinner ring */}
          <Animated.View style={[
            styles.spinnerRing,
            {
              transform: [{ rotate: spin1Rotation }],
              borderColor: 'transparent',
              borderRightColor: primaryColor,
              borderBottomColor: primaryColor,
            }
          ]} />

          {/* Second spinner ring */}
          <Animated.View style={[
            styles.spinnerRing,
            {
              transform: [{ rotate: spin2Rotation }],
              borderColor: 'transparent',
              borderTopColor: primaryColor,
            }
          ]} />
        </View>

        {/* Text */}
        <Text style={[
          styles.text, 
          { color: theme.semanticColors.textSecondary }
        ]}>
          Xavo is thinking...
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginVertical: 8,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: '75%',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientBackground1: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  gradientBackground2: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  spinnerRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
  },
}); 