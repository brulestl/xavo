import { supabase } from '../lib/supabase';

export async function generateCorporateSummary(userId: string): Promise<string> {
  console.log('🏢 Generating corporate summary for user:', userId);

  try {
    const { data, error } = await supabase
      .rpc('generate_corporate_summary', { p_user_id: userId });

    if (error) {
      console.error('❌ Error calling generate_corporate_summary RPC:', error);
      throw error;
    }

    if (!data || typeof data !== 'string') {
      throw new Error('Invalid response from generate_corporate_summary RPC');
    }

    console.log('✅ Successfully generated corporate summary:', data);
    return data;

  } catch (error) {
    console.error('💥 Error in generateCorporateSummary:', error);
    throw error;
  }
} 