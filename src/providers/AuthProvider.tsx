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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type Tier = 'trial' | 'strategist' | 'shark';

interface AuthProviderProps {
  children: ReactNode;
}

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
  markOnboardingComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const DAILY_QUERY_KEY = '@daily_query_count';
const LAST_RESET_DATE_KEY = '@last_reset_date';
const MAX_FREE_QUERIES = 3;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);
  const [tier, setTier] = useState<Tier>('trial');
  const [loading, setLoading] = useState(true);
  const [dailyQueryCount, setDailyQueryCount] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const loadTrialQueryCount = async () => {
    try {
      const today = new Date().toDateString();
      const lastResetDate = await AsyncStorage.getItem(`${LAST_RESET_DATE_KEY}_trial`);
      
      if (lastResetDate !== today) {
        await AsyncStorage.setItem(`${LAST_RESET_DATE_KEY}_trial`, today);
        await AsyncStorage.setItem(`${DAILY_QUERY_KEY}_trial`, '0');
        setDailyQueryCount(0);
      } else {
        const count = await AsyncStorage.getItem(`${DAILY_QUERY_KEY}_trial`);
        setDailyQueryCount(parseInt(count || '0', 10));
      }
    } catch (error) {
      console.error('Error loading trial query count:', error);
      setDailyQueryCount(0);
    }
  };

  const loadDailyQueryCount = async () => {
    try {
      const today = new Date().toDateString();
      const lastResetDate = await AsyncStorage.getItem(LAST_RESET_DATE_KEY);
      
      if (lastResetDate !== today) {
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

  const initializeUserData = async (userId: string) => {
    try {
      // Validate UUID format before making API call
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (!uuidRegex.test(userId)) {
        console.error('Invalid user ID format:', userId);
        setHasCompletedOnboarding(false);
        return;
      }

      // Check if user has completed personalization (onboarding)
      const { data: personalization, error: personalizationError } = await supabase
        .from('user_personalization')
        .select('onboarding_status, personality_scores')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (personalizationError) {
        console.error('Error fetching personalization:', {
          code: personalizationError.code,
          message: personalizationError.message,
          details: personalizationError.details
        });
        setHasCompletedOnboarding(false);
      } else if (personalization) {
        // Check if onboarding is actually complete
        const isComplete = personalization.onboarding_status === 'completed' || 
                          (personalization.personality_scores && Object.keys(personalization.personality_scores).length > 0);
        console.log('Onboarding status:', personalization.onboarding_status, 'Is complete:', isComplete);
        setHasCompletedOnboarding(isComplete);
      } else {
        // No personalization record found - needs onboarding
        console.log('User needs to complete onboarding...');
        setHasCompletedOnboarding(false);
      }
      
      const userTier = await getTierForUser(userId);
      setTier(userTier);
      if (userTier !== 'shark') {
        await loadDailyQueryCount();
      }
      
      const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
      setDisplayName(name);
    } catch (error) {
      console.error('Error initializing user data:', error);
      setHasCompletedOnboarding(false);
    }
  };

  const getTierForUser = async (userId: string): Promise<Tier> => {
    if (user?.email?.includes('shark')) {
      return 'shark';
    }
    return 'strategist';
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        initializeUserData(session.user.id);
      } else {
        setTier('trial');
        loadTrialQueryCount();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await initializeUserData(session.user.id);
        } else {
          setTier('trial');
          await loadTrialQueryCount();
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
      const redirectTo = makeRedirectUri({
        scheme: 'xavo',
        path: '/auth/callback',
      });

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      return { error };
    } catch (error) {
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
      
      setSession(null);
      setUser(null);
      setTier('trial');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
      
      await AsyncStorage.multiRemove([
        DAILY_QUERY_KEY,
        LAST_RESET_DATE_KEY,
        `${DAILY_QUERY_KEY}_trial`,
        `${LAST_RESET_DATE_KEY}_trial`
      ]);
      
    } catch (error) {
      console.error('AuthProvider: Logout failed:', error);
      setSession(null);
      setUser(null);
      setTier('trial');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
    }
  };

  const canMakeQuery = (): boolean => {
    if (tier === 'shark') return true;
    return dailyQueryCount < MAX_FREE_QUERIES;
  };

  const incrementQueryCount = async () => {
    if (tier === 'shark') return;
    
    const newCount = dailyQueryCount + 1;
    setDailyQueryCount(newCount);
    
    const storageKey = session ? DAILY_QUERY_KEY : `${DAILY_QUERY_KEY}_trial`;
    await AsyncStorage.setItem(storageKey, newCount.toString());
  };

  const resetDailyQueries = async () => {
    setDailyQueryCount(0);
    const storageKey = session ? DAILY_QUERY_KEY : `${DAILY_QUERY_KEY}_trial`;
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
      await supabase.auth.signOut();
      await AsyncStorage.clear();
      
      setSession(null);
      setUser(null);
      setTier('trial');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
      
      console.log('All user data and cookies cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
      setSession(null);
      setUser(null);
      setTier('trial');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
    }
  };

  const markOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
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
    markOnboardingComplete,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 