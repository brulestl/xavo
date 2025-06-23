import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  PanResponder,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { TierBadge } from './ui/TierBadge';

// USE SCREEN DIMENSIONS FOR ABSOLUTE STABILITY - NEVER AFFECTED BY KEYBOARD
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

interface SettingsDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigateToSubscriptions: () => void;
  onNavigateToOnboardingEdit: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isVisible,
  onClose,
  onNavigateToSubscriptions,
  onNavigateToOnboardingEdit,
}) => {
  console.log('🔧 SettingsDrawer rendered - isVisible:', isVisible); // Debug log
  const { theme } = useTheme();
  const { displayName, user, tier, updateDisplayName, logout } = useAuth();
  
  const [editingName, setEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);
  const [saving, setSaving] = useState(false);

  // Animation setup with NATIVE DRIVER - Initialize based on isVisible
  const slideAnim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;
  const fadeAnim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;

  React.useEffect(() => {
    console.log('🔧 SettingsDrawer useEffect triggered - isVisible:', isVisible);
    
    if (isVisible) {
      // Reset animation values and start show animation
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
      
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log('🔧 SettingsDrawer show animation completed');
      });
    } else {
      // Start hide animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log('🔧 SettingsDrawer hide animation completed');
      });
    }
  }, [isVisible, slideAnim, fadeAnim]);

  // Sync tempDisplayName with displayName from auth
  React.useEffect(() => {
    setTempDisplayName(displayName);
  }, [displayName]);

  // Swipe to close gesture with NATIVE DRIVER ANIMATIONS
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return gestureState.dx < -20 && Math.abs(gestureState.dy) < 100;
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dx < 0) {
        const progress = Math.min(1, Math.abs(gestureState.dx) / 100);
        slideAnim.setValue(1 - progress);
        fadeAnim.setValue(1 - progress);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dx < -50) {
        onClose();
      } else {
        // Snap back with NATIVE DRIVER
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
  });

  const handleSaveDisplayName = async () => {
    if (!tempDisplayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setSaving(true);
    const { error } = await updateDisplayName(tempDisplayName.trim());
    setSaving(false);
    
    if (error) {
      Alert.alert('Error', 'Failed to update display name');
    } else {
      setEditingName(false);
    }
  };

  const handleSignOut = async () => {
    console.log('🔥 Sign out button pressed!'); // Debug log
    try {
      onClose(); // Close the drawer first
      await logout(); // Then logout
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Error during sign out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  // FIXED TRANSLATION CALCULATION
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_WIDTH * 0.75, 0], // Slide in from right
  });

  // Don't render if not visible - simplified logic
  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents="auto"
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: theme.semanticColors.background,
            borderColor: theme.semanticColors.border,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
        pointerEvents="auto"
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.semanticColors.border }]}>
          <Text style={[styles.headerTitle, { color: theme.semanticColors.textPrimary }]}>
            Settings
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={[styles.closeArrow, { color: theme.semanticColors.textPrimary }]}>
              ➝
            </Text>
          </TouchableOpacity>
        </View>

        {/* STICKY ACCOUNT SECTION - NEVER SCROLLS */}
        <View style={styles.stickySection}>
          <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
            Account
          </Text>
          
          {/* Display Name */}
          <View style={styles.settingItem}>
            <Text style={[styles.settingLabel, { color: theme.semanticColors.textSecondary }]}>
              Display Name
            </Text>
            {editingName ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: theme.semanticColors.textPrimary,
                      borderColor: theme.semanticColors.border,
                      backgroundColor: theme.semanticColors.cardBackground,
                    },
                  ]}
                  value={tempDisplayName}
                  onChangeText={setTempDisplayName}
                  onBlur={handleSaveDisplayName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveDisplayName}
                  editable={!saving}
                />
                {saving && (
                  <Text style={[styles.savingText, { color: theme.semanticColors.textSecondary }]}>
                    Saving...
                  </Text>
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setEditingName(true);
                  setTempDisplayName(displayName);
                }}
              >
                <Text style={[styles.settingValue, { color: theme.semanticColors.textPrimary }]}>
                  {displayName}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Email */}
          <View style={styles.settingItem}>
            <Text style={[styles.settingLabel, { color: theme.semanticColors.textSecondary }]}>
              Email
            </Text>
            <Text style={[styles.settingValue, { color: theme.semanticColors.textSecondary }]}>
              {user?.email}
            </Text>
          </View>

          {/* Tier */}
          <View style={styles.settingItem}>
            <Text style={[styles.settingLabel, { color: theme.semanticColors.textSecondary }]}>
              Plan
            </Text>
            <TierBadge tier={tier} size="small" />
          </View>
        </View>

        {/* SCROLLABLE CONTENT with KEYBOARD PERSISTENCE */}
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {/* Personalization Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
              Personalization
            </Text>
            
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: theme.semanticColors.border }]}
              onPress={onNavigateToOnboardingEdit}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.semanticColors.textPrimary}
              />
              <Text style={[styles.actionButtonText, { color: theme.semanticColors.textPrimary }]}>
                Edit profile answers
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.semanticColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Subscriptions */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: theme.semanticColors.border }]}
              onPress={onNavigateToSubscriptions}
            >
              <Ionicons
                name="card-outline"
                size={20}
                color={theme.semanticColors.textPrimary}
              />
              <Text style={[styles.actionButtonText, { color: theme.semanticColors.textPrimary }]}>
                Subscriptions
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.semanticColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.signOutText}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    // ABSOLUTE FULL-SCREEN POSITIONING - NEVER MOVES
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,  // FIXED SCREEN WIDTH
    height: SCREEN_HEIGHT, // FIXED SCREEN HEIGHT
    zIndex: 50000, // EXTREMELY HIGH Z-INDEX TO PREVENT ANY INTERFERENCE
  },
  backdrop: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    // ABSOLUTE POSITIONING FOR DRAWER PANEL
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '75%',
    height: SCREEN_HEIGHT, // FIXED SCREEN HEIGHT
    borderLeftWidth: StyleSheet.hairlineWidth,
    elevation: 50, // EXTREMELY HIGH ELEVATION FOR ANDROID
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // PREVENT ANY TRANSFORMATIONS OR LAYOUT CHANGES
    transform: [],
    // FORCE LAYOUT ISOLATION
    isolation: 'isolate',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    backgroundColor: 'inherit', // Inherit drawer background
    zIndex: 1, // Ensure header stays above content
    // PREVENT LAYOUT SHIFTS
    minHeight: 56, // Fixed minimum height
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    // PREVENT TEXT SHIFTS
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
    // FIXED POSITIONING
    top: '50%',
    marginTop: -12, // Center vertically
  },
  closeArrow: {
    fontSize: 20,
    fontWeight: '600',
  },
  stickySection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'inherit', // Inherit drawer background
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    zIndex: 1, // Ensure sticky section stays above scrollable content
    // PREVENT LAYOUT SHIFTS
    minHeight: 200, // Fixed minimum height for account section
  },
  content: {
    flex: 1,
    paddingTop: 16,
    // PREVENT CONTENT INTERFERENCE
    zIndex: 0,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  editContainer: {
    marginTop: 4,
  },
  textInput: {
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  savingText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    backgroundColor: '#FFF0F0', // Light red background to make it more visible
    minHeight: 44, // Ensure minimum touch target size
    width: '100%', // Ensure full width
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30', // Red color for sign out
  },
}); 