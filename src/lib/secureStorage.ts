import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Keys that should be stored securely (JWT tokens and other sensitive data)
const SECURE_KEYS = [
  'supabase.auth.token',
  'sb-wdhmlynmbrhunizbdhdt-auth-token', // Supabase auth token key format
  'sb-auth-token', // Generic Supabase token key
  'access_token',
  'refresh_token',
  'user_token',
  'auth_token'
];

// Check if a key should be stored securely
const shouldUseSecureStore = (key: string): boolean => {
  return SECURE_KEYS.some(secureKey => 
    key.includes(secureKey) || 
    key.includes('auth-token') || 
    key.includes('access_token') || 
    key.includes('refresh_token')
  );
};

// Platform-safe SecureStore methods
const platformSecureStore = {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`Web localStorage getItem failed for ${key}:`, error);
        return null;
      }
    }
    
    // Use SecureStore for native platforms
    return await SecureStore.getItemAsync(key);
  },
  
  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      try {
        localStorage.setItem(key, value);
        return;
      } catch (error) {
        console.warn(`Web localStorage setItem failed for ${key}:`, error);
        throw error;
      }
    }
    
    // Use SecureStore for native platforms
    return await SecureStore.setItemAsync(key, value);
  },
  
  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      try {
        localStorage.removeItem(key);
        return;
      } catch (error) {
        console.warn(`Web localStorage removeItem failed for ${key}:`, error);
        throw error;
      }
    }
    
    // Use SecureStore for native platforms
    return await SecureStore.deleteItemAsync(key);
  }
};

export class SecureStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      console.log(`🔐 SecureStorage: Getting item for key: ${key} (Platform: ${Platform.OS})`);
      
      if (shouldUseSecureStore(key)) {
        console.log(`🔒 Using ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} for sensitive key: ${key}`);
        const result = await platformSecureStore.getItemAsync(key);
        console.log(`🔒 ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} result exists: ${!!result}`);
        return result;
      } else {
        console.log(`📦 Using AsyncStorage for non-sensitive key: ${key}`);
        const result = await AsyncStorage.getItem(key);
        console.log(`📦 AsyncStorage result exists: ${!!result}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ SecureStorage getItem error for key ${key}:`, error);
      // Fallback to AsyncStorage on error
      try {
        return await AsyncStorage.getItem(key);
      } catch (fallbackError) {
        console.error(`❌ AsyncStorage fallback error for key ${key}:`, fallbackError);
        return null;
      }
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log(`🔐 SecureStorage: Setting item for key: ${key} (Platform: ${Platform.OS})`);
      
      if (shouldUseSecureStore(key)) {
        console.log(`🔒 Using ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} for sensitive key: ${key}`);
        await platformSecureStore.setItemAsync(key, value);
        console.log(`✅ ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} set successful for key: ${key}`);
      } else {
        console.log(`📦 Using AsyncStorage for non-sensitive key: ${key}`);
        await AsyncStorage.setItem(key, value);
        console.log(`✅ AsyncStorage set successful for key: ${key}`);
      }
    } catch (error) {
      console.error(`❌ SecureStorage setItem error for key ${key}:`, error);
      // Fallback to AsyncStorage on error
      try {
        await AsyncStorage.setItem(key, value);
        console.warn(`⚠️ Used AsyncStorage fallback for key: ${key}`);
      } catch (fallbackError) {
        console.error(`❌ AsyncStorage fallback error for key ${key}:`, fallbackError);
        throw fallbackError;
      }
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      console.log(`🔐 SecureStorage: Removing item for key: ${key} (Platform: ${Platform.OS})`);
      
      if (shouldUseSecureStore(key)) {
        console.log(`🔒 Using ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} to remove sensitive key: ${key}`);
        await platformSecureStore.deleteItemAsync(key);
        console.log(`✅ ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} remove successful for key: ${key}`);
      } else {
        console.log(`📦 Using AsyncStorage to remove non-sensitive key: ${key}`);
        await AsyncStorage.removeItem(key);
        console.log(`✅ AsyncStorage remove successful for key: ${key}`);
      }
    } catch (error) {
      console.error(`❌ SecureStorage removeItem error for key ${key}:`, error);
      // Try both storages to ensure cleanup
      try {
        await platformSecureStore.deleteItemAsync(key);
      } catch {}
      try {
        await AsyncStorage.removeItem(key);
      } catch {}
    }
  }

  async clear(): Promise<void> {
    console.log(`🔐 SecureStorage: Clearing all storage (Platform: ${Platform.OS})`);
    
    try {
      // Clear AsyncStorage (this gets all non-secure keys)
      await AsyncStorage.clear();
      console.log('✅ AsyncStorage cleared');
      
      // For SecureStore/localStorage, we need to clear known secure keys individually
      const secureKeysToRemove = [
        'supabase.auth.token',
        'sb-wdhmlynmbrhunizbdhdt-auth-token',
        'sb-auth-token',
        'access_token', 
        'refresh_token',
        'user_token',
        'auth_token'
      ];
      
      for (const key of secureKeysToRemove) {
        try {
          await platformSecureStore.deleteItemAsync(key);
        } catch (error) {
          // Ignore errors for keys that don't exist
          console.log(`🔍 ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} key ${key} not found (expected)`);
        }
      }
      
      console.log(`✅ ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} keys cleared`);
    } catch (error) {
      console.error('❌ SecureStorage clear error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const secureStorage = new SecureStorageAdapter();

// Export utility functions for direct secure storage operations
export const secureStorageUtils = {
  // Store sensitive data securely
  setSecure: async (key: string, value: string): Promise<void> => {
    console.log(`🔒 Storing sensitive data for key: ${key} (Platform: ${Platform.OS})`);
    await platformSecureStore.setItemAsync(key, value);
  },
  
  // Get sensitive data securely
  getSecure: async (key: string): Promise<string | null> => {
    console.log(`🔒 Retrieving sensitive data for key: ${key} (Platform: ${Platform.OS})`);
    return await platformSecureStore.getItemAsync(key);
  },
  
  // Remove sensitive data securely
  removeSecure: async (key: string): Promise<void> => {
    console.log(`🔒 Removing sensitive data for key: ${key} (Platform: ${Platform.OS})`);
    await platformSecureStore.deleteItemAsync(key);
  },
  
  // Check if SecureStore is available (always true now with platform fallbacks)
  isAvailable: async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return true; // localStorage is always available on web
    }
    return await SecureStore.isAvailableAsync();
  }
}; 