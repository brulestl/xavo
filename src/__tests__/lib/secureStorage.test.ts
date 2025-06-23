import { SecureStorageAdapter } from '../../lib/secureStorage';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('SecureStorageAdapter', () => {
  let adapter: SecureStorageAdapter;

  beforeEach(() => {
    adapter = new SecureStorageAdapter();
    jest.clearAllMocks();
  });

  describe('getItem', () => {
    it('should use SecureStore for sensitive keys', async () => {
      const mockToken = 'mock-jwt-token';
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockToken);

      const result = await adapter.getItem('supabase.auth.token');

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('supabase.auth.token');
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(result).toBe(mockToken);
    });

    it('should use AsyncStorage for non-sensitive keys', async () => {
      const mockValue = 'mock-value';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockValue);

      const result = await adapter.getItem('user_preferences');

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('user_preferences');
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
      expect(result).toBe(mockValue);
    });

    it('should detect various token key patterns', async () => {
      const tokenKeys = [
        'sb-wdhmlynmbrhunizbdhdt-auth-token',
        'access_token',
        'refresh_token',
        'user_auth_token',
        'my_app_access_token'
      ];

      for (const key of tokenKeys) {
        await adapter.getItem(key);
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(key);
      }
    });

    it('should fallback to AsyncStorage on SecureStore error', async () => {
      const mockValue = 'fallback-value';
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockValue);

      const result = await adapter.getItem('supabase.auth.token');

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('supabase.auth.token');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('supabase.auth.token');
      expect(result).toBe(mockValue);
    });
  });

  describe('setItem', () => {
    it('should use SecureStore for sensitive keys', async () => {
      const key = 'refresh_token';
      const value = 'mock-refresh-token';

      await adapter.setItem(key, value);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, value);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should use AsyncStorage for non-sensitive keys', async () => {
      const key = 'user_settings';
      const value = 'mock-settings';

      await adapter.setItem(key, value);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, value);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should fallback to AsyncStorage on SecureStore error', async () => {
      const key = 'access_token';
      const value = 'mock-access-token';
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

      await adapter.setItem(key, value);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, value);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, value);
    });
  });

  describe('removeItem', () => {
    it('should use SecureStore for sensitive keys', async () => {
      const key = 'sb-auth-token';

      await adapter.removeItem(key);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should use AsyncStorage for non-sensitive keys', async () => {
      const key = 'app_theme';

      await adapter.removeItem(key);

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('should try both storages on error to ensure cleanup', async () => {
      const key = 'auth_token';
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

      await adapter.removeItem(key);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
    });
  });

  describe('clear', () => {
    it('should clear both AsyncStorage and known secure keys', async () => {
      await adapter.clear();

      expect(AsyncStorage.clear).toHaveBeenCalled();
      
      // Check that known secure keys are deleted
      const expectedSecureKeys = [
        'supabase.auth.token',
        'sb-wdhmlynmbrhunizbdhdt-auth-token',
        'sb-auth-token',
        'access_token',
        'refresh_token',
        'user_token',
        'auth_token'
      ];

      for (const key of expectedSecureKeys) {
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
      }
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.clear as jest.Mock).mockRejectedValue(new Error('AsyncStorage error'));
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

      await expect(adapter.clear()).rejects.toThrow('AsyncStorage error');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await adapter.getItem('access_token');

      expect(result).toBeNull();
    });

    it('should handle empty string values', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('');

      const result = await adapter.getItem('refresh_token');

      expect(result).toBe('');
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'auth-token@user#123';
      
      await adapter.setItem(specialKey, 'test-value');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(specialKey, 'test-value');
    });
  });
}); 