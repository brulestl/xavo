import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacityProps, Animated } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface PillProps extends TouchableOpacityProps {
  title: string;
  variant?: 'default' | 'selected';
  size?: 'small' | 'medium';
}

export const Pill: React.FC<PillProps> = ({
  title,
  variant = 'default',
  size = 'medium',
  disabled = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();

  const getPillStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: 9999, // Fully rounded pill shape
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      borderWidth: 1,
      shadowColor: theme.semanticColors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    };

    // Size variations
    const sizeStyles = {
      small: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 32 },
      medium: { paddingVertical: 12, paddingHorizontal: 20, minHeight: 40 },
    };

    // Variant styles
    const variantStyles = {
      default: {
        backgroundColor: theme.semanticColors.surface,
        borderColor: theme.semanticColors.border,
      },
      selected: {
        backgroundColor: theme.semanticColors.primary + '10',
        borderColor: theme.semanticColors.primary,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: '500',
      textAlign: 'center',
    };

    // Size-based font sizes
    const sizeTextStyles = {
      small: { fontSize: 13 },
      medium: { fontSize: 14 },
    };

    const variantTextStyles = {
      default: {
        color: theme.semanticColors.textPrimary,
      },
      selected: {
        color: theme.semanticColors.primary,
      },
    };

    return {
      ...baseStyle,
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
      ...(disabled && { opacity: 0.6 }),
    };
  };

  return (
    <TouchableOpacity
      style={[getPillStyle(), style]}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      <Text style={getTextStyle()} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}; 