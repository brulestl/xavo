import { PLAN_LIMITS, Tier } from "../config/plans";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Credits.ts - Supabase configuration:');
console.log('- URL:', supabaseUrl);
console.log('- Service key exists:', !!supabaseServiceKey);
console.log('- Service key length:', supabaseServiceKey?.length || 0);
console.log('- Service key starts with eyJ:', supabaseServiceKey?.startsWith('eyJ') || false);
console.log('- Service key preview:', supabaseServiceKey?.substring(0, 20) + '...');

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for credit operations');
}

if (!supabaseServiceKey.startsWith('eyJ')) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY does not look like a valid JWT token');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function assertPromptCredit(userId: string, tier: Tier) {
  const cap = PLAN_LIMITS[tier].dailyPromptCap;
  
  console.log(`🎯 Attempting to assert prompt credit for user ${userId} with tier ${tier} (cap: ${cap})`);
  
  try {
    console.log(`🔍 Calling Supabase RPC fn_consume_daily with params:`, { p_user: userId, p_cap: cap });
    
    const { error } = await supabase.rpc("fn_consume_daily", {
      p_user: userId,
      p_cap: cap
    });
    
    if (error) {
      console.error('❌ Supabase RPC error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Usage tracking failed: ${error.message}`);
    }
    
    console.log(`✅ Daily prompt credit consumed for user ${userId} with tier ${tier} (cap: ${cap}) - Success`);
    return true;
  } catch (error) {
    console.error('💥 Error in assertPromptCredit:', error);
    throw error;
  }
}

export async function getDailyUsage(userId: string, tier: Tier) {
  const cap = PLAN_LIMITS[tier].dailyPromptCap;
  
  try {
    const { data, error } = await supabase.rpc("fn_get_daily_usage", {
      p_user: userId
    });
    
    if (error) {
      console.error('Database error in getDailyUsage:', error);
      throw new Error(`Usage check failed: ${error.message}`);
    }
    
    const usage = data || { used: 0 };
    const remaining = Math.max(0, cap - usage.used);
    
    return {
      used: usage.used,
      cap: cap,
      remaining: remaining,
      date: usage.usage_date || new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Error in getDailyUsage:', error);
    throw error;
  }
} 