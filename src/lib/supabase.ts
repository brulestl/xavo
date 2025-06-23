import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const extra = (Constants.expoConfig as any)?.extra || {};
const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials—please set them in app.json extra block or as EXPO_PUBLIC_ env vars');
}

console.log('🔐 Configuring Supabase with secure storage for JWT tokens');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { 
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
}); 