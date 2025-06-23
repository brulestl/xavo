import { secureStorageUtils } from '../lib/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Debug utility to verify secure storage is working
export const secureStorageDebug = {
  // Check if tokens are stored securely
  checkTokenSecurity: async (): Promise<{
    secureTokensFound: string[];
    asyncTokensFound: string[];
    isSecure: boolean;
  }> => {
    console.log('🔍 Checking token security...');
    
    const potentialTokenKeys = [
      'supabase.auth.token',
      'sb-wdhmlynmbrhunizbdhdt-auth-token', 
      'sb-auth-token',
      'access_token',
      'refresh_token',
      'user_token',
      'auth_token'
    ];
    
    const secureTokensFound: string[] = [];
    const asyncTokensFound: string[] = [];
    
    // Check SecureStore
    for (const key of potentialTokenKeys) {
      try {
        const secureValue = await secureStorageUtils.getSecure(key);
        if (secureValue) {
          secureTokensFound.push(key);
          console.log(`🔒 Found secure token: ${key}`);
        }
      } catch (error) {
        // Key doesn't exist or error - expected
      }
    }
    
    // Check AsyncStorage for tokens (should be empty for security)
    for (const key of potentialTokenKeys) {
      try {
        const asyncValue = await AsyncStorage.getItem(key);
        if (asyncValue) {
          asyncTokensFound.push(key);
          console.warn(`⚠️ Found token in AsyncStorage (insecure): ${key}`);
        }
      } catch (error) {
        // Key doesn't exist or error - expected
      }
    }
    
    const isSecure = secureTokensFound.length > 0 && asyncTokensFound.length === 0;
    
    console.log(`✅ Secure tokens found: ${secureTokensFound.length}`);
    console.log(`⚠️ Insecure tokens found: ${asyncTokensFound.length}`);
    console.log(`🔐 Overall security status: ${isSecure ? 'SECURE' : 'NEEDS ATTENTION'}`);
    
    return {
      secureTokensFound,
      asyncTokensFound,
      isSecure
    };
  },
  
  // List all AsyncStorage keys (for debugging)
  listAsyncStorageKeys: async (): Promise<readonly string[]> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      console.log('📦 AsyncStorage keys:', keys);
      return keys;
    } catch (error) {
      console.error('❌ Error listing AsyncStorage keys:', error);
      return [];
    }
  },
  
  // Verify secure storage is available
  verifySecureStoreAvailable: async (): Promise<boolean> => {
    try {
      const isAvailable = await secureStorageUtils.isAvailable();
      console.log(`🔒 SecureStore available: ${isAvailable}`);
      return isAvailable;
    } catch (error) {
      console.error('❌ Error checking SecureStore availability:', error);
      return false;
    }
  },
  
  // Test secure storage functionality
  testSecureStorage: async (): Promise<boolean> => {
    try {
      console.log('🧪 Testing secure storage functionality...');
      
      const testKey = 'test_secure_token';
      const testValue = 'test_jwt_token_value';
      
      // Store test value
      await secureStorageUtils.setSecure(testKey, testValue);
      console.log('✅ Test value stored securely');
      
      // Retrieve test value
      const retrievedValue = await secureStorageUtils.getSecure(testKey);
      const isValid = retrievedValue === testValue;
      console.log(`✅ Test value retrieved: ${isValid ? 'SUCCESS' : 'FAILED'}`);
      
      // Clean up test value
      await secureStorageUtils.removeSecure(testKey);
      console.log('✅ Test value cleaned up');
      
      return isValid;
    } catch (error) {
      console.error('❌ Secure storage test failed:', error);
      return false;
    }
  },
  
  // Run comprehensive security check
  runSecurityCheck: async (): Promise<{
    secureStoreAvailable: boolean;
    secureStorageFunctional: boolean;
    tokenSecurityStatus: {
      secureTokensFound: string[];
      asyncTokensFound: string[];
      isSecure: boolean;
    };
    recommendations: string[];
  }> => {
    console.log('🔍 Running comprehensive security check...');
    
    const secureStoreAvailable = await secureStorageDebug.verifySecureStoreAvailable();
    const secureStorageFunctional = await secureStorageDebug.testSecureStorage();
    const tokenSecurityStatus = await secureStorageDebug.checkTokenSecurity();
    
    const recommendations: string[] = [];
    
    if (!secureStoreAvailable) {
      recommendations.push('SecureStore is not available - tokens may be stored insecurely');
    }
    
    if (!secureStorageFunctional) {
      recommendations.push('SecureStore is not functioning properly - check device compatibility');
    }
    
    if (tokenSecurityStatus.asyncTokensFound.length > 0) {
      recommendations.push('Tokens found in AsyncStorage - consider clearing and re-authenticating');
    }
    
    if (tokenSecurityStatus.secureTokensFound.length === 0 && tokenSecurityStatus.asyncTokensFound.length === 0) {
      recommendations.push('No tokens found - user may need to authenticate');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Token security looks good! 🔒');
    }
    
    console.log('📋 Security recommendations:', recommendations);
    
    return {
      secureStoreAvailable,
      secureStorageFunctional,
      tokenSecurityStatus,
      recommendations
    };
  }
};

// Add to global scope for easy console debugging
if (__DEV__) {
  (global as any).secureStorageDebug = secureStorageDebug;
  console.log('🔧 secureStorageDebug available globally in __DEV__ mode');
} 