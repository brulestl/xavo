import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacityProps } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
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
      borderRadius: 9999, // rounded-full equivalent
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    };

    // Size variations
    const sizeStyles = {
      small: { paddingVertical: 8, paddingHorizontal: 16 },
      medium: { paddingVertical: 12, paddingHorizontal: 24 },
      large: { paddingVertical: 16, paddingHorizontal: 32 },
    };

    // Variant styles
    const variantStyles = {
      primary: {
        backgroundColor: disabled ? `${theme.accent}66` : theme.accent,
      },
      secondary: {
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.accent,
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
      fontSize: 16,
    };

    const variantTextStyles = {
      primary: {
        color: theme.colors.eerieBlack,
      },
      secondary: {
        color: theme.textPrimary,
      },
      outline: {
        color: theme.accent,
      },
    };

    return {
      ...baseStyle,
      ...variantTextStyles[variant],
      ...(disabled && { opacity: 0.6 }),
    };
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      disabled={disabled}
      {...props}
    >
      <Text style={getTextStyle()}>{title}</Text>
    </TouchableOpacity>
  );
}; 