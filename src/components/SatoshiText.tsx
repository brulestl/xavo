import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface SatoshiTextProps extends TextProps {
  variant?: 'header' | 'subheader' | 'body';
  weight?: 'regular' | 'medium' | 'bold' | 'black';
}

export const SatoshiText: React.FC<SatoshiTextProps> = ({
  variant = 'body',
  weight = 'regular',
  style,
  children,
  ...props
}) => {
  const { theme } = useTheme();

  const getTextStyle = () => {
    const baseStyle = {
      color: theme.semanticColors.textPrimary,
      fontFamily: 'Satoshi', // Will fall back to system font if not available
    };

    const variantStyles = {
      header: {
        fontSize: 28,
        fontWeight: weight === 'bold' ? '700' as const : weight === 'medium' ? '600' as const : '400' as const,
        lineHeight: 34,
      },
      subheader: {
        fontSize: 20,
        fontWeight: weight === 'bold' ? '700' as const : weight === 'medium' ? '600' as const : '400' as const,
        lineHeight: 26,
      },
      body: {
        fontSize: 16,
        fontWeight: weight === 'bold' ? '600' as const : weight === 'medium' ? '500' as const : '400' as const,
        lineHeight: 22,
      },
    };

    return [baseStyle, variantStyles[variant], style];
  };

  return (
    <Text style={getTextStyle()} {...props}>
      {children}
    </Text>
  );
}; 