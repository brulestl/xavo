import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { apiFetch } from '../src/lib/api';

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
      await apiFetch('/auth/signout', {
        method: 'POST'
      });

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
      const userData = await apiFetch<User>('/auth/me');
      setUser(userData);

    } catch (err) {
      // Handle 401 errors (user not authenticated)
      if (err instanceof Error && err.message.includes('401')) {
        setUser(null);
        return;
      }
      
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