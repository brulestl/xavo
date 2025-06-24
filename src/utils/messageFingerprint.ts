/**
 * Generate a stable fingerprint for a message to prevent duplicates
 * Uses content + sessionId to create a unique identifier that doesn't depend on timing
 */
export const fingerprint = (content: string, sessionId: string): string => {
  const normalized = content.trim().toLowerCase();
  // Simple hash implementation for React Native compatibility
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${sessionId}_${Math.abs(hash).toString(16)}`;
};

/**
 * Generate a stable fingerprint using simple concatenation (fallback if crypto unavailable)
 */
export const fingerprintSimple = (content: string, sessionId: string): string => {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, '_');
  return `${sessionId}_${normalized.substring(0, 32)}`;
};

/**
 * Get the current fingerprint implementation (will use crypto if available, fallback otherwise)
 */
export const getMessageFingerprint = (content: string, sessionId: string): string => {
  try {
    return fingerprint(content, sessionId);
  } catch (error) {
    console.warn('Crypto not available, using simple fingerprint:', error);
    return fingerprintSimple(content, sessionId);
  }
};

/**
 * Generate a stable client ID for message deduplication
 * Uses expo-crypto if available, fallback to timestamp + random
 */
export const generateClientId = (): string => {
  try {
    // Try to use expo-crypto for better randomness
    const { randomUUID } = require('expo-crypto');
    return randomUUID();
  } catch (error) {
    // Fallback to timestamp + random for React Native compatibility
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `client-${timestamp}-${random}`;
  }
}; 