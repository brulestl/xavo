import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

export interface PersonaSummaryResponse {
  summary: string;
}

export const generatePersonaSummary = async (userId: string): Promise<string> => {
  console.log('🎭 Generating persona summary for user:', userId);

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
      //   url: 'https://your-deployed-api.com/api/v1/profile/generate-persona-summary',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      //   } as Record<string, string>,
      //   body: JSON.stringify({ userId }),
      // },
      
      // Option 2: Supabase RPC function (primary for Expo app)
      ...(supabaseUrl && supabaseAnonKey ? [{
        url: `${supabaseUrl}/rest/v1/rpc/generate_persona_summary`,
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
          if (rawResponse.length > 0 && rawResponse.length <= 500) {
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
          console.log('✅ Successfully generated persona summary:', summary);
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
    return await generateFallbackPersonaSummary(userId);

  } catch (error) {
    console.error('💥 Error in generatePersonaSummary:', error);
    return await generateFallbackPersonaSummary(userId);
  }
};

const generateFallbackPersonaSummary = async (userId: string): Promise<string> => {
  try {
    console.log('🔄 Generating fallback persona summary for user:', userId);

    // Try to get user personalization data to create a basic summary
    const { data: personalization, error } = await supabase
      .from('user_personalization')
      .select('current_position, primary_function, top_challenges, company_size, personality_scores, metadata')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching personalization for fallback:', error);
      return "As a Professional in a mid-sized firm, you communicate directly, tackle conflict by addressing issues head-on, and decide via data-driven analysis. You face challenges like strategic communication and influence. Your trait scores are: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%.";
    }

    if (!personalization) {
      return "As a Professional in a mid-sized firm, you communicate directly, tackle conflict by addressing issues head-on, and decide via data-driven analysis. You face challenges like strategic communication and influence. Your trait scores are: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%.";
    }

    // Extract data for template interpolation
    const role = personalization.current_position || 'Professional';
    const companySize = personalization.company_size || 'mid-sized';
    const primaryFunction = personalization.primary_function || 'their department';
    const challenges = personalization.top_challenges?.slice(0, 2).join(', ') || 'strategic communication and influence';

    // Extract personality answers from metadata (with fallbacks)
    const personalityAnswers = personalization.metadata?.personalityAnswers || {};
    const communicationStyle = personalityAnswers.communication_style || 'directly and clearly';
    const conflictApproach = personalityAnswers.conflict_approach || 'addressing issues head-on';
    const decisionMaking = personalityAnswers.decision_making || 'data-driven analysis';

    // Extract personality scores (convert to percentages, with fallbacks)
    const personalityScores = personalization.personality_scores || {};
    const assertiveness = Math.round((personalityScores.assertiveness || 0.5) * 100);
    const strategic = Math.round((personalityScores.strategic || 0.5) * 100);
    const adaptability = Math.round((personalityScores.adaptability || 0.5) * 100);
    const empathy = Math.round((personalityScores.empathy || 0.5) * 100);
    const conscientiousness = Math.round((personalityScores.conscientiousness || 0.5) * 100);
    const integrity = Math.round((personalityScores.integrity || 0.5) * 100);

    // Generate rich persona summary using the template
    const personaSummary = `As a ${role} leading ${primaryFunction} in a ${companySize}-person firm, you communicate ${communicationStyle}, tackle conflict by ${conflictApproach}, and decide via ${decisionMaking}. You face challenges like ${challenges}. Your trait scores are: Assertiveness ${assertiveness}%, Strategic ${strategic}%, Adaptability ${adaptability}%, Empathy ${empathy}%, Conscientiousness ${conscientiousness}%, Integrity ${integrity}%.`;

    return personaSummary.slice(0, 500);

  } catch (error) {
    console.error('Error generating fallback persona summary:', error);
    return "As a Professional in a mid-sized firm, you communicate directly, tackle conflict by addressing issues head-on, and decide via data-driven analysis. You face challenges like strategic communication and influence. Your trait scores are: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%.";
  }
}; 