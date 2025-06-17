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

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = { auth: true }
): Promise<T> {
  console.log('🔍 apiFetch called with:', { path, method: init.method || 'GET' });
  console.log('🔍 API_URL:', API_URL);
  console.log('🔍 BASE URL:', BASE);
  console.log('🔍 Full URL will be:', `${BASE}${path}`);
  
  try {
    console.log('🔍 Getting session...');
    const session = (await supabase.auth.getSession()).data.session;
    console.log('🔍 Session exists:', !!session);
    console.log('🔍 Access token exists:', !!session?.access_token);
    
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
      console.log('🔍 Authorization header added');
    }
    
    console.log('🔍 Request headers:', Object.keys(headers));
    console.log('🔍 Request body:', init.body ? 'Present' : 'None');
    
    console.log('🌐 Making fetch request to:', `${BASE}${path}`);
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    console.log('🌐 Fetch completed, status:', res.status);
    
    if (!res.ok) {
      console.error('🚨 Response not OK:', res.status, res.statusText);
      const text = await res.text();
      console.error('🚨 Response body:', text);
      throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
    }
    
    console.log('✅ Response OK, parsing JSON...');
    const result = await res.json();
    console.log('✅ JSON parsed successfully');
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