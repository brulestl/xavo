import { supabase } from './supabase';

const BASE = `${process.env.EXPO_PUBLIC_API_URL}/api/v1`;

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = { auth: true }
): Promise<T> {
  console.log('🔍 apiFetch called with:', { path, method: init.method || 'GET' });
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