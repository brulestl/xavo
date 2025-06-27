import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export type Tier = 'trial' | 'strategist' | 'shark';

interface TierContextType {
  tier: Tier;
  setTier: (tier: Tier) => Promise<void>;
  isLoading: boolean;
}

const TierContext = createContext<TierContextType | undefined>(undefined);

export const useTier = () => {
  const context = useContext(TierContext);
  if (!context) {
    throw new Error('useTier must be used within a TierProvider');
  }
  return context;
};

interface TierProviderProps {
  children: ReactNode;
}

export const TierProvider: React.FC<TierProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTierState] = useState<Tier>('strategist');
  const [isLoading, setIsLoading] = useState(true);

  // Load tier from Supabase on mount
  useEffect(() => {
    loadTierFromSupabase();
  }, [user?.id]);

  const loadTierFromSupabase = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading tier from Supabase:', error);
        // Default to strategist if no profile exists
        setTierState('strategist');
      } else {
        setTierState(data?.tier || 'strategist');
      }
    } catch (error) {
      console.error('Failed to load tier:', error);
      setTierState('strategist');
    } finally {
      setIsLoading(false);
    }
  };

  const setTier = async (newTier: Tier) => {
    if (!user?.id) {
      console.error('Cannot set tier: user not authenticated');
      return;
    }

    try {
      // Optimistically update UI
      setTierState(newTier);

      // Update Supabase
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            user_id: user.id,
            tier: newTier,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Error updating tier in Supabase:', error);
        // Revert on error
        await loadTierFromSupabase();
        throw error;
      }

      console.log(`✅ Tier updated to ${newTier} for user ${user.id}`);
    } catch (error) {
      console.error('Failed to update tier:', error);
      throw error;
    }
  };

  return (
    <TierContext.Provider value={{ tier, setTier, isLoading }}>
      {children}
    </TierContext.Provider>
  );
}; 