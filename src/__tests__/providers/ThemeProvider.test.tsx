import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../../providers/ThemeProvider';
import { View, Text } from 'react-native';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Test component that uses the theme hook
const TestComponent: React.FC = () => {
  const {
    theme,
    isDark,
    toggleTheme,
    getBackgroundClass,
    getCardBackgroundClass,
    getTextPrimaryClass,
    getTextSecondaryClass,
    getPrimaryButtonClass,
  } = useTheme();

  return (
    <View testID="test-component">
      <Text testID="is-dark">{isDark.toString()}</Text>
      <Text testID="background-color">{theme.getBackgroundColor()}</Text>
      <Text testID="card-background-color">{theme.getCardBackgroundColor()}</Text>
      <Text testID="primary-text-color">{theme.getPrimaryTextColor()}</Text>
      <Text testID="secondary-text-color">{theme.getSecondaryTextColor()}</Text>
      <Text testID="accent-color">{theme.getAccentColor()}</Text>
      <Text testID="background-class">{getBackgroundClass()}</Text>
      <Text testID="card-background-class">{getCardBackgroundClass()}</Text>
      <Text testID="text-primary-class">{getTextPrimaryClass()}</Text>
      <Text testID="text-secondary-class">{getTextSecondaryClass()}</Text>
      <Text testID="primary-button-class">{getPrimaryButtonClass()}</Text>
      <Text testID="toggle-theme" onPress={toggleTheme}>
        Toggle Theme
      </Text>
    </View>
  );
};

const renderWithThemeProvider = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should render children without crashing', () => {
      const { getByTestId } = renderWithThemeProvider(<TestComponent />);
      expect(getByTestId('test-component')).toBeTruthy();
    });

    it('should start with light theme by default', () => {
      const { getByTestId } = renderWithThemeProvider(<TestComponent />);
      expect(getByTestId('is-dark')).toHaveTextContent('false');
    });

    it('should load saved theme from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(getByTestId('is-dark')).toHaveTextContent('true');
      });

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@app_theme_mode');
    });
  });

  describe('theme colors', () => {
    it('should provide correct light theme colors', () => {
      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      expect(getByTestId('background-color')).toHaveTextContent('#E8EDDF'); // alabaster
      expect(getByTestId('card-background-color')).toHaveTextContent('#CFDBD5'); // platinum
      expect(getByTestId('primary-text-color')).toHaveTextContent('#242423'); // eerieBlack
      expect(getByTestId('secondary-text-color')).toHaveTextContent('#333533'); // jet
      expect(getByTestId('accent-color')).toHaveTextContent('#F5CB5C'); // saffron
    });

    it('should provide correct dark theme colors when dark mode is enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(getByTestId('background-color')).toHaveTextContent('#242423'); // eerieBlack
        expect(getByTestId('primary-text-color')).toHaveTextContent('#E8EDDF'); // alabaster
        expect(getByTestId('secondary-text-color')).toHaveTextContent('#CFDBD5'); // platinum
      });
    });
  });

  describe('Tailwind classes', () => {
    it('should provide correct light theme Tailwind classes', () => {
      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      expect(getByTestId('background-class')).toHaveTextContent('bg-alabaster');
      expect(getByTestId('card-background-class')).toHaveTextContent('bg-platinum');
      expect(getByTestId('text-primary-class')).toHaveTextContent('text-eerie-black');
      expect(getByTestId('text-secondary-class')).toHaveTextContent('text-jet');
      expect(getByTestId('primary-button-class')).toHaveTextContent('bg-saffron rounded-button text-button font-bold');
    });

    it('should provide correct dark theme Tailwind classes', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(getByTestId('background-class')).toHaveTextContent('bg-eerie-black');
        expect(getByTestId('text-primary-class')).toHaveTextContent('text-alabaster');
        expect(getByTestId('text-secondary-class')).toHaveTextContent('text-platinum');
      });
    });
  });

  describe('theme toggling', () => {
    it('should toggle theme from light to dark', async () => {
      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      expect(getByTestId('is-dark')).toHaveTextContent('false');

      await act(async () => {
        getByTestId('toggle-theme').props.onPress();
      });

      expect(getByTestId('is-dark')).toHaveTextContent('true');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@app_theme_mode', 'dark');
    });

    it('should toggle theme from dark to light', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(getByTestId('is-dark')).toHaveTextContent('true');
      });

      await act(async () => {
        getByTestId('toggle-theme').props.onPress();
      });

      expect(getByTestId('is-dark')).toHaveTextContent('false');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@app_theme_mode', 'light');
    });
  });

  describe('button styles', () => {
    it('should provide correct primary button style', () => {
      const { getByTestId } = renderWithThemeProvider(<TestComponent />);
      // We can't directly test the button style functions in this setup,
      // but we can ensure the theme provides the necessary colors
      expect(getByTestId('accent-color')).toHaveTextContent('#F5CB5C');
    });
  });

  describe('error handling', () => {
    it('should handle AsyncStorage errors gracefully when loading theme', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      renderWithThemeProvider(<TestComponent />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading theme:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should handle AsyncStorage errors gracefully when saving theme', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      await act(async () => {
        getByTestId('toggle-theme').props.onPress();
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error saving theme:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('hook usage outside provider', () => {
    it('should throw error when useTheme is used outside ThemeProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('theme token values', () => {
    it('should have correct theme token values', () => {
      const { getByTestId } = renderWithThemeProvider(<TestComponent />);

      // Test that the core tokens are available
      expect(getByTestId('accent-color')).toHaveTextContent('#F5CB5C'); // saffron
      expect(getByTestId('card-background-color')).toHaveTextContent('#CFDBD5'); // platinum
    });
  });
});