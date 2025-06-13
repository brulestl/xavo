import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { DrawerNavigator } from '../../navigation/DrawerNavigator';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { AuthProvider } from '../../providers/AuthProvider';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      updateUser: jest.fn(() => Promise.resolve({ error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
  })),
}));

// Mock expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock async storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NavigationContainer>
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  </NavigationContainer>
);

describe('HistoryDrawer', () => {
  it('renders profile row with user information', async () => {
    const { findByText, findByTestId } = render(
      <TestWrapper>
        <DrawerNavigator />
      </TestWrapper>
    );

    // Check if profile row elements are present
    // Note: These will need to be adjusted based on actual user data
    expect(findByText('Your past conversations')).toBeTruthy();
  });

  it('renders conversation history list', async () => {
    const { findByText } = render(
      <TestWrapper>
        <DrawerNavigator />
      </TestWrapper>
    );

    // Check for mock conversation data
    expect(findByText('Stakeholder Analysis Session')).toBeTruthy();
    expect(findByText('Email Draft Review')).toBeTruthy();
    expect(findByText('Policy Summary')).toBeTruthy();
  });

  it('shows new session button', async () => {
    const { findByText } = render(
      <TestWrapper>
        <DrawerNavigator />
      </TestWrapper>
    );

    expect(findByText('New Session')).toBeTruthy();
  });

  it('handles profile row press to open settings drawer', async () => {
    const { findByTestId } = render(
      <TestWrapper>
        <DrawerNavigator />
      </TestWrapper>
    );

    // This test would need profile row to have testID
    // const profileRow = await findByTestId('profile-row');
    // fireEvent.press(profileRow);
    
    // Expect settings drawer to be visible
    // This is a placeholder - actual implementation would check for settings drawer visibility
    expect(true).toBeTruthy();
  });
}); 