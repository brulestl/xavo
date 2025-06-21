import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, AuthError, Provider } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { supabase } from '../lib/supabase';

// Complete the auth session for web browsers
WebBrowser.maybeCompleteAuthSession();

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
  updateDisplayName: (name: string) => Promise<{ error?: string }>;
  refreshPersonalization: () => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
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
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';
const MAX_FREE_QUERIES = 3;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);
  const [tier, setTier] = useState<Tier>('trial');
  const [loading, setLoading] = useState(true);
  const [dailyQueryCount, setDailyQueryCount] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  
  // Track initialization to prevent race conditions
  const isInitializingRef = React.useRef(false);

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ Loading timeout reached, forcing loading to false');
        setLoading(false);
        isInitializingRef.current = false;
      }
    }, 5000); // Reduced to 5 second timeout for faster recovery

    return () => clearTimeout(timeout);
  }, [loading]);

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

  const loadCachedOnboardingStatus = async (userId: string): Promise<boolean> => {
    try {
      const cached = await AsyncStorage.getItem(`${ONBOARDING_COMPLETED_KEY}_${userId}`);
      return cached === 'true';
    } catch (error) {
      console.error('Error loading cached onboarding status:', error);
      return false;
    }
  };

  const saveCachedOnboardingStatus = async (userId: string, completed: boolean) => {
    try {
      await AsyncStorage.setItem(`${ONBOARDING_COMPLETED_KEY}_${userId}`, completed.toString());
    } catch (error) {
      console.error('Error saving cached onboarding status:', error);
    }
  };

  const initializeUserData = async (userId: string, userObject: any = null) => {
    console.log('🚀 Initializing user data for:', userId);
    
    try {
      // Validate UUID format before making API call
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (!uuidRegex.test(userId)) {
        console.error('❌ Invalid user ID format:', userId);
        setHasCompletedOnboarding(false);
        return;
      }

      // Load cached onboarding status immediately for better UX
      const cachedOnboardingStatus = await loadCachedOnboardingStatus(userId);
      setHasCompletedOnboarding(cachedOnboardingStatus);
      console.log('💾 Loaded cached onboarding status:', cachedOnboardingStatus);

      // Set basic user info immediately  
      const currentUser = userObject || user;
      const fallbackName = currentUser?.user_metadata?.full_name || 
                          currentUser?.email?.split('@')[0] || 
                          'User';
      setDisplayName(fallbackName);
      
      // Set tier immediately (non-blocking)
      const userTier = await getTierForUser(userId);
      setTier(userTier);

      // Load query count for non-shark users
      if (userTier !== 'shark') {
        loadDailyQueryCount(); // Non-blocking - errors handled internally
      }

      // Background: Verify onboarding status with database (don't block UI)
      supabase
        .from('user_personalization')
        .select('onboarding_status, personality_scores, display_name')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data: personalization, error: personalizationError }) => {
          if (personalizationError) {
            console.error('❌ Error fetching personalization:', personalizationError.message);
            return; // Keep cached values
          }
          
          if (personalization) {
            // Check if onboarding is actually complete
            const isComplete = personalization.onboarding_status === 'completed' || 
                              (personalization.personality_scores && Object.keys(personalization.personality_scores).length > 0);
            
            // Update state and cache if different from cached value
            if (isComplete !== cachedOnboardingStatus) {
              console.log('🔄 Updating onboarding status from', cachedOnboardingStatus, 'to', isComplete);
              setHasCompletedOnboarding(isComplete);
              (async () => {
                try {
                  await saveCachedOnboardingStatus(userId, isComplete);
                } catch (error) {
                  console.error('Error saving cached status:', error);
                }
              })();
            }
            
            // Update display name if we have a better one
            if (personalization.display_name && personalization.display_name !== fallbackName) {
              setDisplayName(personalization.display_name);
            }
          } else {
            // No personalization record - needs onboarding
            if (cachedOnboardingStatus) {
              console.log('🆕 User needs to complete onboarding (clearing cache)');
              setHasCompletedOnboarding(false);
              (async () => {
                try {
                  await saveCachedOnboardingStatus(userId, false);
                } catch (error) {
                  console.error('Error saving cached status:', error);
                }
              })();
            }
            
            // Try to update display name from OAuth (non-blocking)
            supabase.rpc('fn_update_display_name_from_oauth', {
              p_user_id: userId,
              p_display_name: null
            }).then(({ data, error }) => {
              if (!error && data?.display_name) {
                setDisplayName(data.display_name);
              }
            }).catch(console.error);
          }
        })
        .catch(error => {
          console.error('❌ Background personalization fetch failed:', error);
        });
      
      console.log('✅ User data initialization completed');
      
    } catch (error) {
      console.error('❌ Error initializing user data:', error);
      // Keep cached status if available, otherwise set to false
      const cachedStatus = await loadCachedOnboardingStatus(userId).catch(() => false);
      setHasCompletedOnboarding(cachedStatus);
    }
  };

  const getTierForUser = async (userId: string): Promise<Tier> => {
    if (user?.email?.includes('shark')) {
      return 'shark';
    }
    return 'strategist';
  };

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔄 Starting auth initialization...');
      isInitializingRef.current = true;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('📡 Got session:', session ? 'exists' : 'null');
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('👤 User exists, initializing user data...');
          await initializeUserData(session.user.id, session.user);
        } else {
          console.log('🔓 No user, setting trial mode...');
          setTier('trial');
          setHasCompletedOnboarding(false);
          await loadTrialQueryCount();
        }
      } catch (error) {
        console.error('❌ Error during auth initialization:', error);
      } finally {
        console.log('✅ Auth initialization complete, setting loading to false');
        setLoading(false);
        isInitializingRef.current = false;
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, 'Session exists:', !!session);
        
        // Prevent multiple simultaneous initializations
        if (isInitializingRef.current) {
          console.log('⏳ Already initializing, skipping auth state change');
          return;
        }
        
        // Don't set loading for TOKEN_REFRESHED events to avoid UI flicker
        if (event !== 'TOKEN_REFRESHED') {
          setLoading(true);
          isInitializingRef.current = true;
        }
        
        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            console.log('👤 User session exists, initializing user data...');
            await initializeUserData(session.user.id, session.user);
          } else {
            console.log('🔓 No user session, setting trial mode...');
            setTier('trial');
            setHasCompletedOnboarding(false);
            await loadTrialQueryCount();
          }
        } catch (error) {
          console.error('❌ Error during auth state change:', error);
        } finally {
          if (event !== 'TOKEN_REFRESHED') {
            console.log('✅ Auth state change complete, setting loading to false');
            setLoading(false);
            isInitializingRef.current = false;
          }
        }
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
      console.log('🔐 Starting OAuth flow for provider:', provider);
      
      // For Expo Go development, use the correct redirect URI format
      const redirectTo = Platform.OS === 'web' 
        ? makeRedirectUri({
            scheme: 'xavo',
            path: '/auth/callback',
          })
        : makeRedirectUri({
            scheme: 'exp',
            path: '/auth/callback',
          });
      
      console.log('🔗 OAuth redirect URI:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: false, // Always open browser for OAuth
        },
      });

      console.log('📱 OAuth response:', { data: !!data, error: !!error });
      
      if (data?.url) {
        console.log('🌐 Opening OAuth URL:', data.url);
        // For Expo Go, we need to manually open the browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );
        
        console.log('📱 WebBrowser result:', result);
        
        if (result.type === 'success' && result.url) {
          // Extract the session from the redirect URL
          const url = new URL(result.url);
          
          // Check for tokens in URL fragment (after #) - this is where Supabase puts them
          let accessToken = url.searchParams.get('access_token');
          let refreshToken = url.searchParams.get('refresh_token');
          
          // If not in search params, check the fragment (hash)
          if (!accessToken && url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1)); // Remove # and parse
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }
          
          if (accessToken) {
            console.log('✅ OAuth tokens received, setting session');
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (sessionError) {
              console.error('❌ Session error:', sessionError);
              return { error: sessionError };
            }
            
            console.log('✅ OAuth session set successfully');
            return { error: null };
          } else {
            console.error('❌ No access token in redirect URL');
            return { error: { message: 'No access token received' } as AuthError };
          }
        } else if (result.type === 'cancel') {
          console.log('❌ OAuth cancelled by user');
          return { error: { message: 'OAuth cancelled by user' } as AuthError };
        } else {
          console.error('❌ OAuth failed:', result);
          return { error: { message: 'OAuth failed' } as AuthError };
        }
      }

      return { error };
    } catch (error) {
      console.error('❌ OAuth error:', error);
      return { error: error as AuthError };
    }
  };

  const logout = async () => {
    try {
      console.log('🔐 AuthProvider: Starting logout process...');
      console.log('🔐 Current auth state before logout - Session:', !!session, 'User:', !!user, 'Tier:', tier);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ AuthProvider: Logout error:', error);
        throw error;
      }
      
      console.log('✅ AuthProvider: Successfully signed out from Supabase');
      
      // Clear all state
      console.log('🔐 AuthProvider: Clearing all state...');
      setSession(null);
      setUser(null);
      setTier('trial');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
      
      // Clear AsyncStorage including cached onboarding status
      const keysToRemove = [
        DAILY_QUERY_KEY,
        LAST_RESET_DATE_KEY,
        `${DAILY_QUERY_KEY}_trial`,
        `${LAST_RESET_DATE_KEY}_trial`
      ];
      
      // Add onboarding cache key if user exists
      if (user?.id) {
        keysToRemove.push(`${ONBOARDING_COMPLETED_KEY}_${user.id}`);
        console.log('🔐 AuthProvider: Including user-specific cache key:', `${ONBOARDING_COMPLETED_KEY}_${user.id}`);
      }
      
      console.log('🔐 AuthProvider: Clearing AsyncStorage keys:', keysToRemove);
      await AsyncStorage.multiRemove(keysToRemove);
      
      console.log('✅ AuthProvider: All user data cleared');
      console.log('✅ AuthProvider: Logout completed successfully');
      
    } catch (error) {
      console.error('❌ AuthProvider: Logout failed:', error);
      
      // Even if logout fails, clear local state to prevent stuck states
      console.log('🔐 AuthProvider: Clearing local state despite error...');
      setSession(null);
      setUser(null);
      setTier('trial');
      setDailyQueryCount(0);
      setDisplayName('');
      setHasCompletedOnboarding(false);
      
      // Still try to clear storage
      try {
        const keysToRemove = [
          DAILY_QUERY_KEY,
          LAST_RESET_DATE_KEY,
          `${DAILY_QUERY_KEY}_trial`,
          `${LAST_RESET_DATE_KEY}_trial`
        ];
        
        // Add onboarding cache key if user exists
        if (user?.id) {
          keysToRemove.push(`${ONBOARDING_COMPLETED_KEY}_${user.id}`);
        }
        
        await AsyncStorage.multiRemove(keysToRemove);
      } catch (storageError) {
        console.error('❌ Failed to clear AsyncStorage:', storageError);
      }
      
      throw error; // Re-throw so UI can show error message
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

  const updateDisplayName = async (name: string): Promise<{ error?: string }> => {
    if (!user?.id) {
      return { error: 'User not authenticated' };
    }

    try {
      const { data, error } = await supabase.rpc('fn_update_display_name_from_oauth', {
        p_user_id: user.id,
        p_display_name: name
      });

      if (error) throw error;

      setDisplayName(data.display_name);
      return {};
    } catch (error) {
      console.error('Error updating display name:', error);
      return { error: 'Failed to update display name' };
    }
  };

  const refreshPersonalization = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('fn_get_user_personalization_with_answers', {
        p_user_id: user.id
      });

      if (error) throw error;

      const personalization = data?.personalization || {};
      setDisplayName(personalization.display_name || user.email?.split('@')[0] || 'User');
      
      // Update onboarding status
      const isComplete = personalization.onboarding_status === 'completed' || 
                        (personalization.personality_scores && Object.keys(personalization.personality_scores).length > 0);
      setHasCompletedOnboarding(isComplete);
      
      // Update cached status
      await saveCachedOnboardingStatus(user.id, isComplete);
      console.log('🔄 Refreshed personalization and updated cache:', isComplete);
    } catch (error) {
      console.error('Error refreshing personalization:', error);
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

  const markOnboardingComplete = async () => {
    setHasCompletedOnboarding(true);
    if (user?.id) {
      await saveCachedOnboardingStatus(user.id, true);
      console.log('✅ Onboarding marked as complete and cached');
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
    refreshPersonalization,
    markOnboardingComplete,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 