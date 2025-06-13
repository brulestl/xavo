import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacityProps, Animated } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'cta';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: 12, // Xavo's 12px radius
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      shadowColor: theme.semanticColors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    };

    // Size variations
    const sizeStyles = {
      small: { paddingVertical: 10, paddingHorizontal: 20, minHeight: 40 },
      medium: { paddingVertical: 14, paddingHorizontal: 28, minHeight: 48 },
      large: { paddingVertical: 18, paddingHorizontal: 36, minHeight: 56 },
    };

    // Variant styles
    const variantStyles = {
      primary: {
        backgroundColor: disabled ? theme.semanticColors.primaryDisabled : theme.semanticColors.primary,
      },
      secondary: {
        backgroundColor: theme.semanticColors.surface,
        borderWidth: 1,
        borderColor: theme.semanticColors.border,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.semanticColors.primary,
      },
      cta: {
        backgroundColor: disabled ? theme.semanticColors.cta + '66' : theme.semanticColors.cta,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: '600',
      textAlign: 'center',
    };

    // Size-based font sizes
    const sizeTextStyles = {
      small: { fontSize: 14 },
      medium: { fontSize: 16 },
      large: { fontSize: 18 },
    };

    const variantTextStyles = {
      primary: {
        color: theme.colors.pureWhite,
      },
      secondary: {
        color: theme.semanticColors.textPrimary,
      },
      outline: {
        color: theme.semanticColors.primary,
      },
      cta: {
        color: theme.colors.pureWhite,
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
      style={[getButtonStyle(), style]}
      disabled={disabled}
      activeOpacity={0.8}
      {...props}
    >
      <Text style={getTextStyle()}>{title}</Text>
    </TouchableOpacity>
  );
}; 