import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface DrawerProps {
  isVisible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  title?: string;
  width?: number; // Percentage of screen width (default 75)
  stickyHeader?: React.ReactNode; // NEW: Sticky content that doesn't scroll
}

// USE SCREEN DIMENSIONS FOR ABSOLUTE STABILITY - NEVER AFFECTED BY KEYBOARD
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

export const Drawer: React.FC<DrawerProps> = ({
  isVisible,
  onClose,
  children,
  title,
  width = 75,
  stickyHeader,
}) => {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // CALCULATE DRAWER WIDTH ONCE AND NEVER CHANGE
  const drawerWidth = (SCREEN_WIDTH * width) / 100;

  useEffect(() => {
    if (isVisible) {
      // Slide in animation with NATIVE DRIVER for performance and isolation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true, // NATIVE DRIVER - UNAFFECTED BY LAYOUT CHANGES
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true, // NATIVE DRIVER - UNAFFECTED BY LAYOUT CHANGES
        }),
      ]).start();
    } else {
      // Slide out animation with NATIVE DRIVER
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -drawerWidth,
          duration: 250,
          useNativeDriver: true, // NATIVE DRIVER - UNAFFECTED BY LAYOUT CHANGES
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true, // NATIVE DRIVER - UNAFFECTED BY LAYOUT CHANGES
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, overlayOpacity, drawerWidth]);

  // Don't render if drawer is closed
  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* FULL-SCREEN OVERLAY - ABSOLUTELY POSITIONED */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
          },
        ]}
        pointerEvents="auto"
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* DRAWER PANEL - ABSOLUTELY POSITIONED */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: theme.semanticColors.surface,
            width: drawerWidth,
            transform: [{ translateX: slideAnim }],
            shadowColor: theme.semanticColors.shadow,
          },
        ]}
        pointerEvents="auto"
      >
        {/* STICKY HEADER - NEVER SCROLLS */}
        {title && (
          <View style={[styles.header, { borderBottomColor: theme.semanticColors.border }]}>
            <Text style={[styles.title, { color: theme.semanticColors.textPrimary }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: theme.semanticColors.textSecondary }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STICKY CONTENT SECTION - NEVER SCROLLS */}
        {stickyHeader && (
          <View style={styles.stickyHeaderContent}>
            {stickyHeader}
          </View>
        )}

        {/* SCROLLABLE CONTENT SECTION */}
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  overlay: {
    // ABSOLUTE FULL-SCREEN OVERLAY
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,  // FIXED SCREEN WIDTH
    height: SCREEN_HEIGHT, // FIXED SCREEN HEIGHT
    backgroundColor: '#000000',
  },
  overlayTouchable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  drawer: {
    // ABSOLUTE POSITIONING FOR DRAWER PANEL
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    height: SCREEN_HEIGHT, // FIXED SCREEN HEIGHT
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 50, // EXTREMELY HIGH ELEVATION FOR ANDROID
    // PREVENT ANY TRANSFORMATIONS OR LAYOUT CHANGES
    transform: [],
    // FORCE LAYOUT ISOLATION
    isolation: 'isolate',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    backgroundColor: 'inherit', // Inherit drawer background
    zIndex: 1, // Ensure header stays above content
    // PREVENT LAYOUT SHIFTS
    position: 'relative',
    minHeight: 56, // Fixed minimum height
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    // PREVENT TEXT SHIFTS
    textAlign: 'left',
    flex: 1,
  },
  closeButton: {
    padding: 8,
    // FIXED POSITIONING
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -16, // Center vertically
  },
  closeText: {
    fontSize: 18,
    fontWeight: '400',
  },
  stickyHeaderContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'inherit', // Inherit drawer background
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    zIndex: 1, // Ensure sticky content stays above scrollable content
    // PREVENT LAYOUT SHIFTS
    minHeight: 60, // Fixed minimum height
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    // PREVENT CONTENT INTERFERENCE
    zIndex: 0,
  },
}); 