import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  platinum: string;
  alabaster: string;
  saffron: string;
  eerieBlack: string;
  jet: string;
}

export interface ThemeSemanticColors {
  primary: string;
  primaryDisabled: string;
  background: string;
  cardBackground: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  surface: string;
  border: string;
  shadow: string;
}

export interface Theme {
  colors: ThemeColors;
  semanticColors: ThemeSemanticColors;
  
  // Backward compatibility properties
  cardBackground: string;
  screenBackground: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  surface: string;
  border: string;
  shadow: string;
  
  // Utility functions for component styling
  getBackgroundColor: () => string;
  getCardBackgroundColor: () => string;
  getPrimaryTextColor: () => string;
  getSecondaryTextColor: () => string;
  getAccentColor: () => string;
  getPrimaryButtonStyle: () => {
    backgroundColor: string;
    opacity: number;
  };
  getPrimaryButtonDisabledStyle: () => {
    backgroundColor: string;
    opacity: number;
  };
}

const colors: ThemeColors = {
  platinum: '#CFDBD5',
  alabaster: '#E8EDDF',
  saffron: '#F5CB5C',
  eerieBlack: '#242423',
  jet: '#333533',
};

const createTheme = (isDark: boolean): Theme => {
  const semanticColors: ThemeSemanticColors = {
    primary: colors.saffron,
    primaryDisabled: colors.saffron + '66', // 40% opacity
    background: isDark ? colors.eerieBlack : colors.alabaster,
    cardBackground: colors.platinum,
    textPrimary: isDark ? colors.alabaster : colors.eerieBlack,
    textSecondary: isDark ? colors.platinum : colors.jet,
    accent: colors.saffron,
    surface: isDark ? colors.jet : '#FFFFFF',
    border: isDark ? colors.jet : colors.platinum,
    shadow: isDark ? colors.eerieBlack : colors.jet,
  };

  return {
    colors,
    semanticColors,
    
    // Backward compatibility properties (mapped to semantic colors)
    cardBackground: semanticColors.cardBackground,
    screenBackground: semanticColors.background,
    textPrimary: semanticColors.textPrimary,
    textSecondary: semanticColors.textSecondary,
    accent: semanticColors.accent,
    surface: semanticColors.surface,
    border: semanticColors.border,
    shadow: semanticColors.shadow,
    
    getBackgroundColor: () => semanticColors.background,
    getCardBackgroundColor: () => semanticColors.cardBackground,
    getPrimaryTextColor: () => semanticColors.textPrimary,
    getSecondaryTextColor: () => semanticColors.textSecondary,
    getAccentColor: () => semanticColors.accent,
    getPrimaryButtonStyle: () => ({
      backgroundColor: semanticColors.primary,
      opacity: 1,
    }),
    getPrimaryButtonDisabledStyle: () => ({
      backgroundColor: semanticColors.primary,
      opacity: 0.4,
    }),
  };
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  // Tailwind class helpers
  getBackgroundClass: () => string;
  getCardBackgroundClass: () => string;
  getTextPrimaryClass: () => string;
  getTextSecondaryClass: () => string;
  getPrimaryButtonClass: () => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = '@app_theme_mode';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = createTheme(isDark);

  // Tailwind class helpers for NativeWind
  const getBackgroundClass = () => isDark ? 'bg-eerie-black' : 'bg-alabaster';
  const getCardBackgroundClass = () => 'bg-platinum';
  const getTextPrimaryClass = () => isDark ? 'text-alabaster' : 'text-eerie-black';
  const getTextSecondaryClass = () => isDark ? 'text-platinum' : 'text-jet';
  const getPrimaryButtonClass = () => 'bg-saffron rounded-button text-button font-bold';

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        isDark, 
        toggleTheme,
        getBackgroundClass,
        getCardBackgroundClass,
        getTextPrimaryClass,
        getTextSecondaryClass,
        getPrimaryButtonClass,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}; 