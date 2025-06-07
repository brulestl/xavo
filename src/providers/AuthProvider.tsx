import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient, Session, AuthError, Provider } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Tier = 'guest' | 'essential' | 'power';

interface AuthContextType {
  session: Session | null;
  user: any;
  tier: Tier;
  loading: boolean;
  dailyQueryCount: number;
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signup: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: AuthError | null }>;
  logout: () => Promise<void>;
  getTierForUser: (userId: string) => Promise<Tier>;
  canMakeQuery: () => boolean;
  incrementQueryCount: () => Promise<void>;
  resetDailyQueries: () => Promise<void>;
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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    const userTier = await getTierForUser(userId);
    setTier(userTier);
    if (userTier !== 'power') {
      await loadDailyQueryCount();
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
    });
    return { error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setTier('guest');
    setDailyQueryCount(0);
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

  const value: AuthContextType = {
    session,
    user,
    tier,
    loading,
    dailyQueryCount,
    login,
    signup,
    signInWithOAuth,
    logout,
    getTierForUser,
    canMakeQuery,
    incrementQueryCount,
    resetDailyQueries,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 