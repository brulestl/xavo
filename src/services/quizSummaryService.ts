import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

export interface QuizSummaryResponse {
  summary: string;
}

export const generateQuizSummary = async (userId: string): Promise<string> => {
  console.log('🚀 Generating quiz summary for user:', userId);

  try {
    // Get configuration from app.json
    const extra = Constants.expoConfig?.extra || {};
    const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    // Get authentication token from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    console.log('🔑 Auth token available:', !!accessToken);

    // Try multiple endpoints in order of preference
    const endpoints = [
      // Option 1: Deployed NestJS Backend API (if available)
      // {
      //   url: 'https://your-deployed-api.com/api/v1/profile/generate-summary',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      //   } as Record<string, string>,
      //   body: JSON.stringify({ userId }),
      // },
      
      // Option 2: Supabase RPC function (primary for Expo app)
      ...(supabaseUrl && supabaseAnonKey ? [{
        url: `${supabaseUrl}/rest/v1/rpc/generate_quiz_summary`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        } as Record<string, string>,
        body: JSON.stringify({ user_id: userId }),
      }] : []),
    ];

    console.log('🌐 Trying endpoints:', endpoints.length);

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      console.log(`📡 Trying endpoint ${i + 1}:`, endpoint.url);

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: endpoint.headers,
          body: endpoint.body,
        });

        console.log(`📊 Response ${i + 1} status:`, response.status);
        console.log(`📊 Response ${i + 1} headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`❌ Endpoint ${i + 1} failed:`, response.status, errorText);
          continue;
        }

        const rawResponse = await response.text();
        console.log(`📄 Raw response ${i + 1}:`, rawResponse);

        if (!rawResponse) {
          console.log(`⚠️ Empty response from endpoint ${i + 1}`);
          continue;
        }

        // Try to parse the response
        let parsedResponse: any;
        try {
          parsedResponse = JSON.parse(rawResponse);
        } catch (parseError) {
          console.log(`⚠️ Failed to parse JSON from endpoint ${i + 1}:`, parseError);
          // If it's not JSON, maybe it's just the summary text
          if (rawResponse.length > 0 && rawResponse.length <= 300) {
            return rawResponse.trim();
          }
          continue;
        }

        // Extract summary from different possible response formats
        let summary: string | undefined;

        if (typeof parsedResponse === 'string') {
          summary = parsedResponse;
        } else if (parsedResponse.summary) {
          summary = parsedResponse.summary;
        } else if (parsedResponse.data && parsedResponse.data.summary) {
          summary = parsedResponse.data.summary;
        } else if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
          summary = parsedResponse[0].summary || parsedResponse[0];
        }

        if (summary && typeof summary === 'string' && summary.trim().length > 0) {
          console.log('✅ Successfully generated quiz summary:', summary);
          return summary.trim();
        }

        console.log(`⚠️ No valid summary found in response ${i + 1}:`, parsedResponse);

      } catch (fetchError) {
        console.log(`💥 Network error with endpoint ${i + 1}:`, fetchError);
        continue;
      }
    }

    // If all endpoints failed, return a fallback summary
    console.log('⚠️ All endpoints failed, generating fallback summary');
    return await generateFallbackSummary(userId);

  } catch (error) {
    console.error('💥 Error in generateQuizSummary:', error);
    return await generateFallbackSummary(userId);
  }
};

const generateFallbackSummary = async (userId: string): Promise<string> => {
  try {
    console.log('🔄 Generating fallback summary for user:', userId);

    // Try to get user personalization data to create a basic summary
    const { data: personalization, error } = await supabase
      .from('user_personalization')
      .select('current_position, primary_function, top_challenges, company_size')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching personalization for fallback:', error);
      return "Professional seeking to enhance corporate influence and leadership skills.";
    }

    if (!personalization) {
      return "Professional seeking to enhance corporate influence and leadership skills.";
    }

    const parts = [];
    
    if (personalization.current_position) {
      parts.push(personalization.current_position);
    }
    
    if (personalization.primary_function) {
      parts.push(`in ${personalization.primary_function}`);
    }
    
    if (personalization.top_challenges && personalization.top_challenges.length > 0) {
      const mainChallenge = personalization.top_challenges[0];
      parts.push(`focusing on ${mainChallenge.toLowerCase()}`);
    }

    const summary = parts.length > 0 
      ? `${parts.join(' ')} seeking to develop corporate influence and leadership capabilities.`
      : "Professional seeking to enhance corporate influence and leadership skills.";

    return summary.slice(0, 300);

  } catch (error) {
    console.error('Error generating fallback summary:', error);
    return "Professional seeking to enhance corporate influence and leadership skills.";
  }
}; 