import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  platinum: string;
  alabaster: string;
  saffron: string;
  eerieBlack: string;
  jet: string;
}

export interface Theme {
  colors: ThemeColors;
  cardBackground: string;
  screenBackground: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  surface: string;
  border: string;
  shadow: string;
}

const colors: ThemeColors = {
  platinum: '#CFDBD5',
  alabaster: '#E8EDDF',
  saffron: '#F5CB5C',
  eerieBlack: '#242423',
  jet: '#333533',
};

const lightTheme: Theme = {
  colors,
  cardBackground: colors.platinum,
  screenBackground: colors.alabaster,
  textPrimary: colors.eerieBlack,
  textSecondary: colors.jet,
  accent: colors.saffron,
  surface: '#FFFFFF',
  border: colors.platinum,
  shadow: colors.jet,
};

const darkTheme: Theme = {
  colors,
  cardBackground: colors.platinum,
  screenBackground: colors.eerieBlack,
  textPrimary: colors.alabaster,
  textSecondary: colors.platinum,
  accent: colors.saffron,
  surface: colors.jet,
  border: colors.jet,
  shadow: colors.eerieBlack,
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
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

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}; 