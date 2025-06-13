import { useState, useEffect } from 'react';
import { Alert } from 'react-native';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isSignedIn: boolean;
  error: string | null;
  
  // Actions
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignedIn = !!user;

  // Sign out user
  const signOut = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call sign out endpoint
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/signout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
          // 'Authorization': `Bearer ${userToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Sign out failed: ${response.statusText}`);
      }

      // Clear user state
      setUser(null);
      
      // TODO: Clear any stored tokens/session data
      // await AsyncStorage.removeItem('userToken');
      // await AsyncStorage.removeItem('refreshToken');

      Alert.alert(
        'Signed Out',
        'You have been successfully signed out.',
        [{ text: 'OK' }]
      );

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign out failed';
      setError(errorMessage);
      Alert.alert('Sign Out Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
          // 'Authorization': `Bearer ${userToken}`,
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // User is not authenticated
          setUser(null);
          return;
        }
        throw new Error(`Failed to get user: ${response.statusText}`);
      }

      const userData = await response.json();
      setUser(userData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get user data';
      setError(errorMessage);
      console.warn('Failed to refresh user:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Load user on mount
  useEffect(() => {
    refreshUser();
  }, []);

  return {
    user,
    isLoading,
    isSignedIn,
    error,
    
    // Actions
    signOut,
    refreshUser
  };
}; 