import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface XavoColors {
  // User-specified colors
  assistantBubble: string;
  userBubble: string;
  fileUploadBubble: string;
  
  // Legacy brand colors
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
  
  // New theme-specific methods
  getComposerBackgroundColor: () => string;
  getUserBubbleColor: () => string;
  getAssistantBubbleColor: () => string;
  getFileUploadBubbleColor: () => string;
  getUserMessageTextColor: () => string;
}

const createXavoColors = (isDark: boolean): XavoColors => ({
  // User-specified chat colors (theme-dependent)
  assistantBubble: isDark ? '#333533' : '#e8eddf',
  userBubble: '#0071fc',
  fileUploadBubble: '#f5cb5c',
  
  // Legacy brand colors
  xavoBlue: '#4285F4',
  growthGreen: '#1DB954',
  pureWhite: '#FFFFFF',
  deepNavy: '#011C27',
  nearlyBlack: '#1A1A1A',
  mutedAccent: '#4285F466',
});

const createTheme = (isDark: boolean): Theme => {
  const colors = createXavoColors(isDark);
  
  const semanticColors: ThemeSemanticColors = {
    primary: colors.xavoBlue,
    primaryDisabled: colors.xavoBlue + '66', // 40% opacity
    background: isDark ? '#242423' : '#FFFFFF',
    cardBackground: isDark ? '#242423' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : colors.nearlyBlack,
    textSecondary: isDark ? '#FFFFFF' + 'CC' : colors.nearlyBlack + 'AA',
    accent: isDark ? colors.mutedAccent : colors.xavoBlue,
    surface: isDark ? '#242423' : '#FFFFFF',
    border: isDark ? '#FFFFFF' + '20' : colors.nearlyBlack + '10',
    shadow: isDark ? colors.nearlyBlack : colors.nearlyBlack + '20',
    cta: colors.growthGreen,
  };

  return {
    colors,
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
    
    // New theme-specific methods
    getComposerBackgroundColor: () => isDark ? '#333533' : '#e8eddf',
    getUserBubbleColor: () => colors.userBubble,
    getAssistantBubbleColor: () => colors.assistantBubble,
    getFileUploadBubbleColor: () => colors.fileUploadBubble,
    getUserMessageTextColor: () => '#FFFFFF',
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