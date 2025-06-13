import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient, Session, AuthError, Provider } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Complete the auth session for web browsers
WebBrowser.maybeCompleteAuthSession();

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaG1seW5tYnJodW5pemJkaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMDQ2NjgsImV4cCI6MjA2NDg4MDY2OH0.ORKN6Ryiz4Yo_BFhE_CS2yHMGPJDncKtYWKTwwI98N4';

// Debug logging
console.log('Environment variables:', {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  fallbackUrl: supabaseUrl,
  fallbackKey: supabaseAnonKey ? 'present' : 'missing'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Enable URL session detection for web OAuth
  },
});

export type Tier = 'guest' | 'essential' | 'power';

interface AuthContextType {
  session: Session | null;
  user: any;
  tier: Tier;
  loading: boolean;
  dailyQueryCount: number;
  displayName: string;
  hasCompletedOnboarding: boolean;
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signup: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<void>;
  clearAllData: () => Promise<void>;
  getTierForUser: (userId: string) => Promise<Tier>;
  canMakeQuery: () => boolean;
  incrementQueryCount: () => Promise<void>;
  resetDailyQueries: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const DAILY_QUERY_KEY = '@daily_query_count';
const LAST_RESET_DATE_KEY = '@last_reset_date';
const MAX_FREE_QUERIES = 3;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);
  const [tier, setTier] = useState<Tier>('guest');
  const [loading, setLoading] = useState(true);
  const [dailyQueryCount, setDailyQueryCount] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthProvider: Initial session check:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        initializeUserData(session.user.id);
      } else {
        setTier('guest');
        loadGuestQueryCount();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state change:', {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await initializeUserData(session.user.id);
        } else {
          setTier('guest');
          await loadGuestQueryCount();
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const initializeUserData = async (userId: string) => {
    try {
      // Check if user exists in database and has completed onboarding
      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('id, created_at')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // User doesn't exist in database, they need onboarding
        console.log('User not found in database, needs onboarding...');
        setHasCompletedOnboarding(false);
        setTier('guest');
        return;
      }
      
      // Check if user has completed onboarding by looking for personalization data
      const { data: personalization, error: personalizationError } = await supabase
        .from('user_personalization')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (personalizationError && personalizationError.code === 'PGRST116') {
        // User exists but hasn't completed onboarding
        console.log('User exists but needs to complete onboarding...');
        setHasCompletedOnboarding(false);
      } else {
        // User has completed onboarding
        setHasCompletedOnboarding(true);
      }
      
      const userTier = await getTierForUser(userId);
      setTier(userTier);
      if (userTier !== 'power') {
        await loadDailyQueryCount();
      }
      
      // Set display name from user metadata or default
      const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
      setDisplayName(name);
    } catch (error) {
      console.error('Error initializing user data:', error);
      // If there's an error, assume they need onboarding
      setHasCompletedOnboarding(false);
    }
  };

  const getTierForUser = async (userId: string): Promise<Tier> => {
    // In a real app, you'd query your database for user tier
    // For now, we'll use a simple email-based logic
    if (user?.email?.includes('power')) {
      return 'power';
    }
    return 'essential';
  };

  const loadDailyQueryCount = async () => {
    try {
      const today = new Date().toDateString();
      const lastResetDate = await AsyncStorage.getItem(LAST_RESET_DATE_KEY);
      
      if (lastResetDate !== today) {
        // Reset for new day
        await AsyncStorage.setItem(LAST_RESET_DATE_KEY, today);
        await AsyncStorage.setItem(DAILY_QUERY_KEY, '0');
        setDailyQueryCount(0);
      } else {
        const count = await AsyncStorage.getItem(DAILY_QUERY_KEY);
        setDailyQueryCount(parseInt(count || '0', 10));
      }
    } catch (error) {
      console.error('Error loading daily query count:', error);
      setDailyQueryCount(0);
    }
  };

  const loadGuestQueryCount = async () => {
    try {
      const today = new Date().toDateString();
      const lastResetDate = await AsyncStorage.getItem(`${LAST_RESET_DATE_KEY}_guest`);
      
      if (lastResetDate !== today) {
        await AsyncStorage.setItem(`${LAST_RESET_DATE_KEY}_guest`, today);
        await AsyncStorage.setItem(`${DAILY_QUERY_KEY}_guest`, '0');
        setDailyQueryCount(0);
      } else {
        const count = await AsyncStorage.getItem(`${DAILY_QUERY_KEY}_guest`);
        setDailyQueryCount(parseInt(count || '0', 10));
      }
    } catch (error) {
      console.error('Error loading guest query count:', error);
      setDailyQueryCount(0);
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signup = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signInWithOAuth = async (provider: Provider) => {
    try {
      console.log(`Starting ${provider} OAuth on platform:`, Platform.OS);
      
      // For web, use current window location
      const redirectTo = Platform.OS === 'web' 
        ? window.location.origin + '/auth/callback'
        : makeRedirectUri({
            scheme: 'xavo',
            path: '/auth/callback',
          });

      console.log('OAuth redirect URI:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        console.error(`${provider} OAuth error:`, error);
        return { error };
      }

      console.log('OAuth response data:', data);

      // For web platforms, Supabase handles the redirect automatically
      if (Platform.OS === 'web') {
        console.log('Web OAuth initiated, Supabase will handle redirect automatically');
        return { error: null };
      }

      // For mobile platforms, open the auth URL manually
      if (data?.url) {
        console.log('Opening auth URL for mobile:', data.url);
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        console.log('Mobile OAuth result:', result);

        if (result.type === 'success' && result.url) {
          // Parse the URL to extract the session
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');

          console.log('Extracted tokens:', { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken 
          });

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              return { error: sessionError };
            }
            
            console.log('Mobile OAuth session set successfully');
          }
        } else if (result.type === 'cancel') {
          return { error: { message: 'Authentication was cancelled' } as AuthError };
        }
      }

      return { error: null };
    } catch (error) {
      console.error('OAuth error:', error);
      return { error: error as AuthError };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('AuthProvider: Logout error:', error);
        throw error;
      }
      
      // Clear all state
      setSession(null);
      setUser(null);
      setTier('guest');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
      
      // Clear any stored data
      await AsyncStorage.multiRemove([
        DAILY_QUERY_KEY,
        LAST_RESET_DATE_KEY,
        `${DAILY_QUERY_KEY}_guest`,
        `${LAST_RESET_DATE_KEY}_guest`
      ]);
      
    } catch (error) {
      console.error('AuthProvider: Logout failed:', error);
      // Even if logout fails, clear local state
      setSession(null);
      setUser(null);
      setTier('guest');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
    }
  };

  const canMakeQuery = (): boolean => {
    if (tier === 'power') return true;
    return dailyQueryCount < MAX_FREE_QUERIES;
  };

  const incrementQueryCount = async () => {
    if (tier === 'power') return;
    
    const newCount = dailyQueryCount + 1;
    setDailyQueryCount(newCount);
    
    const storageKey = session ? DAILY_QUERY_KEY : `${DAILY_QUERY_KEY}_guest`;
    await AsyncStorage.setItem(storageKey, newCount.toString());
  };

  const resetDailyQueries = async () => {
    setDailyQueryCount(0);
    const storageKey = session ? DAILY_QUERY_KEY : `${DAILY_QUERY_KEY}_guest`;
    await AsyncStorage.setItem(storageKey, '0');
  };

  const updateDisplayName = async (name: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name }
      });
      
      if (error) {
        console.error('Error updating display name:', error);
        return { error };
      }
      
      setDisplayName(name);
      return { error: null };
    } catch (error) {
      console.error('Error updating display name:', error);
      return { error: error as AuthError };
    }
  };

  const clearAllData = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear all AsyncStorage data
      await AsyncStorage.clear();
      
      // Clear all state
      setSession(null);
      setUser(null);
      setTier('guest');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
      
      console.log('All user data and cookies cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
      // Still clear local state even if other operations fail
      setSession(null);
      setUser(null);
      setTier('guest');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    tier,
    loading,
    dailyQueryCount,
    displayName,
    hasCompletedOnboarding,
    login,
    signup,
    signInWithOAuth,
    logout,
    clearAllData,
    getTierForUser,
    canMakeQuery,
    incrementQueryCount,
    resetDailyQueries,
    updateDisplayName,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 