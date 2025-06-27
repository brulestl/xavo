import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { useTier } from '../contexts/TierContext';

interface SharkToggleIconProps {
  size?: number;
}

export const SharkToggleIcon: React.FC<SharkToggleIconProps> = ({ size = 24 }) => {
  const { isDark, theme } = useTheme();
  const { tier, setTier } = useTier();
  
  // Animation refs - Initialize once
  const dialogAnim = useRef(new Animated.Value(0)).current;
  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogText, setDialogText] = React.useState('');
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const toggleTier = useCallback(async () => {
    try {
      // Stop any existing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }
      
      const nextTier = tier === 'shark' ? 'strategist' : 'shark';
      const isActivating = nextTier === 'shark';
      
      // Update tier first
      await setTier(nextTier);
      
      // Then show dialog
      setDialogText(isActivating ? 'Shark Mode ON' : 'Shark Mode OFF');
      setShowDialog(true);
      
      // Reset animation value
      dialogAnim.setValue(0);
      
      // Animate dialog fade in/out
      animationRef.current = Animated.sequence([
        Animated.timing(dialogAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(dialogAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]);
      
      animationRef.current.start(({ finished }) => {
        if (finished) {
          setShowDialog(false);
        }
      });
    } catch (error) {
      console.error('Failed to toggle tier:', error);
    }
  }, [tier, setTier, dialogAnim]);



  // Memoize values to prevent re-renders
  const iconSrc = React.useMemo(() => {
    return isDark 
      ? require('../../media/logo/logo_platinum_67_darkmode.png')
      : require('../../media/logo/logo_eerie-black_67.png');
  }, [isDark]);

  const isSharkActive = tier === 'shark';
  const neonGreen = '#39FF14';
  const redColor = '#FF3131';

  // Memoize border style - always show border (red for OFF, green for ON)
  const borderStyle = React.useMemo(() => {
    return {
      borderWidth: 2,
      borderColor: isSharkActive ? neonGreen : redColor,
      borderRadius: size / 2,
    };
  }, [isSharkActive, neonGreen, redColor, size]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <Pressable onPress={toggleTier} style={styles.pressable}>
        <View style={[styles.iconContainer, borderStyle]}>
          <Image 
            source={iconSrc} 
            style={[styles.icon, { width: size, height: size }]} 
            resizeMode="contain"
          />
        </View>
      </Pressable>

      {/* Dialog positioned below icon */}
      {showDialog && (
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              opacity: dialogAnim,
              transform: [
                {
                  scale: dialogAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[
            styles.dialogText,
            { 
              color: tier === 'shark' ? neonGreen : theme.semanticColors.textPrimary,
            }
          ]}>
            {dialogText}
          </Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pressable: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  icon: {
    // Size set dynamically via style prop
  },
  dialogContainer: {
    position: 'absolute',
    top: 40, // Position below the icon
    left: -30, // Center the dialog relative to icon
    minWidth: 100, // Ensure readable width
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 