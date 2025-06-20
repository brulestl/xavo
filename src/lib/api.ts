import { supabase } from './supabase';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get API URL from Expo configuration with environment and platform detection
function getApiUrl(): string {
  const apiUrlConfig = Constants.expoConfig?.extra?.apiUrl;
  
  // If it's a string (old format), use it directly
  if (typeof apiUrlConfig === 'string') {
    return apiUrlConfig;
  }
  
  // If it's an object (new format), determine the correct URL
  if (typeof apiUrlConfig === 'object' && apiUrlConfig !== null) {
    const environment = __DEV__ ? 'development' : 'production';
    const envConfig = apiUrlConfig[environment];
    
    if (envConfig) {
      // Determine platform
      if (Platform.OS === 'web') {
        return envConfig.web;
      } else if (Platform.OS === 'android') {
        // Check if we're running on a real device vs emulator
        // For now, default to emulator (10.0.2.2)
        // You can add device detection logic here if needed
        return envConfig.android;
      } else if (Platform.OS === 'ios') {
        return envConfig.ios;
      }
    }
  }
  
  // Fallback to localhost
  return 'http://localhost:3000';
}

const API_URL = getApiUrl();
const BASE = `${API_URL}/api/v1`;

// Cache session to avoid repeated fetches
let cachedSession: any = null;
let sessionCacheTime = 0;
const SESSION_CACHE_DURATION = 5000; // 5 seconds

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = { auth: true }
): Promise<T> {
  const isSessionRequest = path === '/chat/sessions' && (init.method || 'GET') === 'GET';
  
  if (!isSessionRequest) {
    console.log('🔍 apiFetch called with:', { path, method: init.method || 'GET' });
  }
  
  try {
    // Use cached session if available and recent
    let session = cachedSession;
    const now = Date.now();
    
    if (!session || (now - sessionCacheTime) > SESSION_CACHE_DURATION) {
      if (!isSessionRequest) console.log('🔍 Getting fresh session...');
      session = (await supabase.auth.getSession()).data.session;
      cachedSession = session;
      sessionCacheTime = now;
    }
    
    if (!isSessionRequest) {
      console.log('🔍 Session exists:', !!session);
      console.log('🔍 Access token exists:', !!session?.access_token);
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([key, value]) => [key, String(value)])
      ),
    };
    
    if (init.auth !== false) {
      if (!session?.access_token) {
        console.error('🚨 No session or access token available');
        throw new Error('No Supabase session – user must be logged in');
      }
      headers.Authorization = `Bearer ${session.access_token}`;
      if (!isSessionRequest) console.log('🔍 Authorization header added');
    }
    
    if (!isSessionRequest) {
      console.log('🔍 Request headers:', Object.keys(headers));
      console.log('🔍 Request body:', init.body ? 'Present' : 'None');
      console.log('🌐 Making fetch request to:', `${BASE}${path}`);
    }
    
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    
    if (!isSessionRequest) console.log('🌐 Fetch completed, status:', res.status);
    
    if (!res.ok) {
      console.error('🚨 Response not OK:', res.status, res.statusText);
      const text = await res.text();
      console.error('🚨 Response body:', text);
      throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
    }
    
    if (!isSessionRequest) console.log('✅ Response OK, parsing JSON...');
    const result = await res.json();
    if (!isSessionRequest) console.log('✅ JSON parsed successfully');
    return result as T;
  } catch (error) {
    console.error('💥 apiFetch error:', error);
    console.error('💥 Error type:', typeof error);
    console.error('💥 Error message:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Helper function to build API URLs (for cases where you need the URL but not the fetch)
export function buildApiUrl(path: string): string {
  return `${BASE}${path}`;
} 