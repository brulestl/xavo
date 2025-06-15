import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AttemptLimiter, Tier } from '../utils/AttemptLimiter';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  tier: Tier;
  email?: string;
  dailyCounter: number;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => void;
  subscribePower: () => Promise<void>;
  canAsk: () => boolean;
  decrementCounter: () => Promise<void>;
  refreshCounter: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context & Hook
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ 
    tier: 'trial', 
    dailyCounter: 0 
  });

  // Initialize counter on mount and when tier changes
  useEffect(() => {
    refreshCounter();
  }, [state.tier]);

  // Reset attempts at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const timeout = setTimeout(() => {
      refreshCounter();
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, []);

  const refreshCounter = async () => {
    try {
      const counter = await AttemptLimiter.getAttemptsLeft(state.tier);
      setState(prev => ({ ...prev, dailyCounter: counter }));
    } catch (error) {
      console.error('Error refreshing counter:', error);
    }
  };

  const login = async (email: string, password: string) => {
    // Mock authentication logic
    try {
      // In a real app, you'd validate credentials with your backend
      console.log('Mock login:', { email, password });
      
      // Mock response - set tier based on email for demo
      const tier: Tier = email.includes('shark') ? 'shark' : 'strategist';
      
      setState(prev => ({ 
        ...prev, 
        tier, 
        email,
        dailyCounter: tier === 'shark' ? Number.MAX_SAFE_INTEGER : 3
      }));
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    // Mock signup logic
    try {
      console.log('Mock signup:', { email, password });
      
      // Default to strategist tier for new signups
      setState(prev => ({ 
        ...prev, 
        tier: 'strategist', 
        email,
        dailyCounter: 3
      }));
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const loginAsGuest = () => {
    setState({ tier: 'trial', dailyCounter: 3 });
  };

  const logout = () => {
    setState({ tier: 'trial', dailyCounter: 3 });
  };

  const subscribePower = async () => {
    // Mock subscription to shark tier
    try {
      console.log('Mock shark subscription');
      setState(prev => ({ 
        ...prev, 
        tier: 'shark',
        dailyCounter: Number.MAX_SAFE_INTEGER
      }));
    } catch (error) {
      console.error('Subscription error:', error);
      throw error;
    }
  };

  const canAsk = () => {
    return AttemptLimiter.canAsk(state.dailyCounter);
  };

  const decrementCounter = async () => {
    if (state.tier !== 'shark') {
      try {
        await AttemptLimiter.decrementAttempts();
        const newCounter = await AttemptLimiter.getAttemptsLeft(state.tier);
        setState(prev => ({ ...prev, dailyCounter: newCounter }));
      } catch (error) {
        console.error('Error decrementing counter:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      ...state, 
      login, 
      signup,
      loginAsGuest, 
      logout, 
      subscribePower,
      canAsk,
      decrementCounter,
      refreshCounter
    }}>
      {children}
    </AuthContext.Provider>
  );
}