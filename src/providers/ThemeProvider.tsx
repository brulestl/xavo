import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface XavoColors {
  // Xavo Brand Colors
  xavoBlue: string;
  growthGreen: string;
  pureWhite: string;
  deepNavy: string;
  nearlyBlack: string;
  mutedAccent: string;
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
  cta: string;
}

export interface Theme {
  colors: XavoColors;
  semanticColors: ThemeSemanticColors;
  
  // Utility functions for component styling
  getBackgroundColor: () => string;
  getCardBackgroundColor: () => string;
  getPrimaryTextColor: () => string;
  getSecondaryTextColor: () => string;
  getAccentColor: () => string;
  getCTAColor: () => string;
  getPrimaryButtonStyle: () => {
    backgroundColor: string;
    opacity: number;
  };
  getPrimaryButtonDisabledStyle: () => {
    backgroundColor: string;
    opacity: number;
  };
}

const xavoColors: XavoColors = {
  xavoBlue: '#4285F4',
  growthGreen: '#1DB954',
  pureWhite: '#FFFFFF',
  deepNavy: '#011C27',
  nearlyBlack: '#1A1A1A',
  mutedAccent: '#4285F466', // Muted blue for night mode
};

const createTheme = (isDark: boolean): Theme => {
  const semanticColors: ThemeSemanticColors = {
    primary: xavoColors.xavoBlue,
    primaryDisabled: xavoColors.xavoBlue + '66', // 40% opacity
    background: isDark ? xavoColors.deepNavy : xavoColors.pureWhite,
    cardBackground: isDark ? xavoColors.deepNavy : xavoColors.pureWhite,
    textPrimary: isDark ? xavoColors.pureWhite : xavoColors.nearlyBlack,
    textSecondary: isDark ? xavoColors.pureWhite + 'CC' : xavoColors.nearlyBlack + 'AA',
    accent: isDark ? xavoColors.mutedAccent : xavoColors.xavoBlue,
    surface: isDark ? xavoColors.deepNavy : xavoColors.pureWhite,
    border: isDark ? xavoColors.pureWhite + '20' : xavoColors.nearlyBlack + '10',
    shadow: isDark ? xavoColors.nearlyBlack : xavoColors.nearlyBlack + '20',
    cta: xavoColors.growthGreen,
  };

  return {
    colors: xavoColors,
    semanticColors,
    
    getBackgroundColor: () => semanticColors.background,
    getCardBackgroundColor: () => semanticColors.cardBackground,
    getPrimaryTextColor: () => semanticColors.textPrimary,
    getSecondaryTextColor: () => semanticColors.textSecondary,
    getAccentColor: () => semanticColors.accent,
    getCTAColor: () => semanticColors.cta,
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
  getCTAButtonClass: () => string;
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

const THEME_STORAGE_KEY = '@xavo_theme_mode';

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
  const getBackgroundClass = () => isDark ? 'bg-deep-navy' : 'bg-pure-white';
  const getCardBackgroundClass = () => isDark ? 'bg-deep-navy' : 'bg-pure-white';
  const getTextPrimaryClass = () => isDark ? 'text-pure-white' : 'text-nearly-black';
  const getTextSecondaryClass = () => isDark ? 'text-pure-white/80' : 'text-nearly-black/70';
  const getPrimaryButtonClass = () => 'bg-xavo-blue rounded-xl';
  const getCTAButtonClass = () => 'bg-growth-green rounded-xl';

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
        getCTAButtonClass,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}; 