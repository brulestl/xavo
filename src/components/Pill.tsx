import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacityProps, Animated } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface PillProps extends TouchableOpacityProps {
  title: string;
  variant?: 'default' | 'selected';
  size?: 'small' | 'medium';
  numberOfLines?: number;
}

export const Pill: React.FC<PillProps> = ({
  title,
  variant = 'default',
  size = 'medium',
  numberOfLines = 2,
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

    // Size variations - Remove fixed minHeight to allow vertical expansion
    const sizeStyles = {
      small: { 
        paddingVertical: 10, 
        paddingHorizontal: 16,
        // Removed minHeight to allow content to determine height
      },
      medium: { 
        paddingVertical: 12, 
        paddingHorizontal: 20,
        // Removed minHeight to allow content to determine height
      },
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
      lineHeight: 18, // Proper line height for multiline text
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
      <Text 
        style={getTextStyle()} 
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}; 