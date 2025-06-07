import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface ContainerProps extends ViewProps {
  variant?: 'screen' | 'card' | 'surface';
  padding?: 'none' | 'small' | 'medium' | 'large';
  margin?: 'none' | 'small' | 'medium' | 'large';
}

export const Container: React.FC<ContainerProps> = ({
  variant = 'screen',
  padding = 'medium',
  margin = 'none',
  style,
  children,
  ...props
}) => {
  const { theme } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flex: 1,
    };

    // Variant styles
    const variantStyles = {
      screen: {
        backgroundColor: theme.screenBackground,
      },
      card: {
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
      },
      surface: {
        backgroundColor: theme.surface,
        borderRadius: 8,
      },
    };

    // Padding variations
    const paddingStyles = {
      none: {},
      small: { padding: 8 },
      medium: { padding: 16 },
      large: { padding: 24 },
    };

    // Margin variations
    const marginStyles = {
      none: {},
      small: { margin: 8 },
      medium: { margin: 16 },
      large: { margin: 24 },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
      ...paddingStyles[padding],
      ...marginStyles[margin],
    };
  };

  return (
    <View style={[getContainerStyle(), style]} {...props}>
      {children}
    </View>
  );
}; 