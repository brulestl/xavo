import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onChooseFile: () => void;
  anchorPosition?: { x: number; y: number };
}

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  visible,
  onClose,
  onTakePhoto,
  onChoosePhoto,
  onChooseFile,
  anchorPosition = { x: 0, y: 0 },
}) => {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleMenuItemPress = (action: () => void) => {
    onClose();
    // Delay the action slightly to allow the menu to close
    setTimeout(action, 150);
  };

  if (!visible) return null;

  const menuItems = [
    {
      icon: 'camera-outline',
      label: 'Take Photo',
      action: () => handleMenuItemPress(onTakePhoto),
      color: '#4CAF50',
    },
    {
      icon: 'image-outline',
      label: 'Choose Photo',
      action: () => handleMenuItemPress(onChoosePhoto),
      color: '#2196F3',
    },
    {
      icon: 'document-outline',
      label: 'Attach File',
      action: () => handleMenuItemPress(onChooseFile),
      color: '#FF9800',
    },
  ];

  return (
    <Modal transparent visible={visible} animationType="none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.menuContainer,
              {
                backgroundColor: theme.semanticColors.surface,
                borderColor: theme.semanticColors.border,
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
                bottom: 120, // Position above the composer
                right: 20,
              },
            ]}
          >
            <View style={styles.menuContent}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    {
                      borderBottomColor: theme.semanticColors.border,
                      borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                    },
                  ]}
                  onPress={item.action}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: item.color },
                    ]}
                  >
                    <Ionicons name={item.icon as any} size={20} color="#FFFFFF" />
                  </View>
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: theme.semanticColors.textPrimary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Arrow pointing down to the attach button */}
            <View
              style={[
                styles.arrow,
                { borderTopColor: theme.semanticColors.surface },
              ]}
            />
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  menuContainer: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'visible',
  },
  menuContent: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 160,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  arrow: {
    position: 'absolute',
    bottom: -8,
    right: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
}); 