import { PLAN_LIMITS, Tier } from "../config/plans";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaG1seW5tYnJodW5pemJkaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMDQ2NjgsImV4cCI6MjA2NDg4MDY2OH0.ORKN6Ryiz4Yo_BFhE_CS2yHMGPJDncKtYWKTwwI98N4';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function assertPromptCredit(userId: string, tier: Tier) {
  const cap = PLAN_LIMITS[tier].dailyPromptCap;
  
  try {
    const { data, error } = await supabase.rpc("fn_consume_daily", {
      p_user: userId,
      p_cap: cap
    });
    
    if (error) {
      console.error('Database error in assertPromptCredit:', error);
      throw new Error(`Usage tracking failed: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("Daily prompt cap reached");
    }
    
    console.log(`Daily prompt credit checked for user ${userId} with tier ${tier} (cap: ${cap}) - Success`);
    return true;
  } catch (error) {
    console.error('Error in assertPromptCredit:', error);
    throw error;
  }
} 