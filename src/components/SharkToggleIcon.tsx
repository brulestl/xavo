import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Animated, Modal, TouchableOpacity, Linking, Platform, ToastAndroid, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SharkToggleIconProps {
  size?: number;
}

const SHARK_MODE_KEY = '@shark_mode_enabled';

export const SharkToggleIcon: React.FC<SharkToggleIconProps> = ({ size = 24 }) => {
  const { isDark, theme } = useTheme();
  const { tier, user } = useAuth();
  
  // Shark-mode state (separate from tier)
  const [isSharkModeEnabled, setIsSharkModeEnabled] = useState(false);
  const [isSubscriptionModalVisible, setIsSubscriptionModalVisible] = useState(false);
  
  // Animation refs
  const modalAnim = useRef(new Animated.Value(0)).current;

  // Load shark-mode state on mount and when user changes
  useEffect(() => {
    loadSharkModeState();
  }, [user?.id]);

  // Reset shark-mode when tier changes to strategist
  useEffect(() => {
    if (tier === 'strategist' && isSharkModeEnabled) {
      console.log('🦈 Resetting shark-mode for strategist tier');
      setIsSharkModeEnabled(false);
      saveSharkModeState(false);
    }
  }, [tier, isSharkModeEnabled]);

  const loadSharkModeState = async () => {
    try {
      if (!user?.id) {
        setIsSharkModeEnabled(false);
        return;
      }
      
      const saved = await AsyncStorage.getItem(`${SHARK_MODE_KEY}_${user.id}`);
      const enabled = saved === 'true';
      setIsSharkModeEnabled(enabled);
      console.log('🦈 Loaded shark-mode state:', enabled, 'for user:', user.id);
    } catch (error) {
      console.error('Failed to load shark-mode state:', error);
      setIsSharkModeEnabled(false);
    }
  };

  const saveSharkModeState = async (enabled: boolean) => {
    try {
      if (!user?.id) return;
      
      await AsyncStorage.setItem(`${SHARK_MODE_KEY}_${user.id}`, enabled.toString());
      console.log('🦈 Saved shark-mode state:', enabled, 'for user:', user.id);
    } catch (error) {
      console.error('Failed to save shark-mode state:', error);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Shark Mode', message);
    }
  };

  const handleToggleSharkMode = useCallback(async () => {
    const newState = !isSharkModeEnabled;
    setIsSharkModeEnabled(newState);
    await saveSharkModeState(newState);
    
    showToast(newState ? 'Shark-mode ON.' : 'Shark-mode OFF.');
  }, [isSharkModeEnabled, user?.id]);

  const handleIconPress = useCallback(() => {
    console.log('🦈 Shark icon pressed, tier:', tier);
    
    if (tier === 'strategist') {
      // Strategist tier: show subscription modal
      console.log('💰 Opening subscription modal for strategist');
      setIsSubscriptionModalVisible(true);
    } else if (tier === 'shark' || tier === 'trial') {
      // Shark and trial (Agent) tiers: toggle shark-mode
      console.log('🔄 Toggling shark-mode for', tier, 'tier');
      handleToggleSharkMode();
    }
  }, [tier, handleToggleSharkMode]);

  const handleSubscribePress = () => {
    setIsSubscriptionModalVisible(false);
    Linking.openURL('https://xavo.app/subscription');
  };

  const handleCloseModal = () => {
    setIsSubscriptionModalVisible(false);
  };

  // Animation for modal
  useEffect(() => {
    if (isSubscriptionModalVisible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isSubscriptionModalVisible]);

  // Determine icon state and styling
  const isToggleable = tier === 'shark' || tier === 'trial';
  const showAsOn = isToggleable && isSharkModeEnabled;
  
  // Memoize values to prevent re-renders
  const iconSrc = React.useMemo(() => {
    return isDark 
      ? require('../../media/logo/logo_platinum_67_darkmode.png')
      : require('../../media/logo/logo_eerie-black_67.png');
  }, [isDark]);

  const neonGreen = '#39FF14';
  const redColor = '#FF3131';

  // Border style based on state
  const borderStyle = React.useMemo(() => {
    return {
      borderWidth: 2,
      borderColor: showAsOn ? neonGreen : redColor,
      borderRadius: size / 2,
    };
  }, [showAsOn, neonGreen, redColor, size]);

  return (
    <>
      <View style={styles.container}>
        <Pressable onPress={handleIconPress} style={styles.pressable}>
          <View style={[styles.iconContainer, borderStyle]}>
            <Image 
              source={iconSrc} 
              style={[styles.icon, { width: size, height: size }]} 
              resizeMode="contain"
            />
          </View>
        </Pressable>
      </View>

      {/* Subscription Modal for Strategist tier */}
      <Modal
        visible={isSubscriptionModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.semanticColors.background,
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnim,
              },
            ]}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
              <Ionicons name="close" size={24} color={theme.semanticColors.textSecondary} />
            </TouchableOpacity>

            {/* Header */}
            <Text style={[styles.modalTitle, { color: theme.semanticColors.textPrimary }]}>
              Shark-mode requires a Shark subscription
            </Text>

            {/* Hint text */}
            <Text style={[styles.modalHint, { color: theme.semanticColors.textSecondary }]}>
              Upgrade to unlock power-play tactics.
            </Text>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.subscribeButton, { backgroundColor: theme.semanticColors.primary }]}
                onPress={handleSubscribePress}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  Subscribe
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    paddingTop: 16,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
    lineHeight: 24,
  },
  modalHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    alignItems: 'center',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    minWidth: 140,
    alignItems: 'center',
  },
  subscribeButton: {
    // Background color set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 