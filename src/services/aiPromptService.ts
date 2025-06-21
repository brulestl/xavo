import { supabase } from '../lib/supabase';

interface UserProfileData {
  current_position?: string;
  primary_function?: string;
  company_size?: string;
  top_challenges?: string[];
  personality_scores?: Record<string, number>;
  preferred_coaching_style?: string;
  metadata?: {
    personalityAnswers?: {
      communication_style?: string;
      conflict_approach?: string;
      decision_making?: string;
    };
  };
}

export async function generateAiPrompts(userId: string, count = 5): Promise<string[]> {
  console.log(`🤖 Generating ${count} AI prompts for user ${userId}`);
  
  try {
    // 📊 Fetch the user's profile context
    const userContext = await fetchUserProfileContext(userId);
    console.log('👤 User context built:', userContext);
    
    // 🚀 Call our backend/Edge Functions to generate prompts
    const aiQuestions = await callBackendForPrompts(userId, userContext, count);
    
    console.log('✅ Successfully generated dynamic AI prompts:', aiQuestions);
    return aiQuestions;
    
  } catch (error) {
    const errorMessage = `💥 AI prompt generation FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMessage);
    
    // Return fallback prompts on error
    const fallbackPrompts = [
      "How do I build stronger stakeholder relationships?",
      "What's the best way to present ideas to leadership?", 
      "How do I navigate competing priorities?",
      "What strategies help me influence without authority?",
      "How can I improve my executive presence?"
    ];
    
    return fallbackPrompts.slice(0, count);
  }
}

async function fetchUserProfileContext(userId: string): Promise<UserProfileData> {
  console.log('📋 Fetching complete user profile from Supabase...');
  console.log('🔍 User ID:', userId);
  
  try {
    // Get comprehensive user personalization data
    const { data: profileData, error: profileError } = await supabase
      .from('user_personalization')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (profileError) {
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }
    
    if (!profileData) {
      throw new Error('User profile not found - user may not have completed onboarding');
    }
    
    console.log('📊 Profile loaded: Role:', profileData.current_position, '| Challenges:', profileData.top_challenges?.join(', '));
    
    return profileData;
  } catch (error) {
    console.error('💥 Error in fetchUserProfileContext:', error);
    throw error;
  }
}

async function callBackendForPrompts(userId: string, userContext: UserProfileData, count: number): Promise<string[]> {
  console.log('🚀 Calling backend for AI prompts...');
  
  try {
    // Get the current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }
    
    // Build context string from user data
    const contextParts = [];
    
    if (userContext.current_position) {
      contextParts.push(`Role: ${userContext.current_position}`);
    }
    
    if (userContext.primary_function) {
      contextParts.push(`Function: ${userContext.primary_function}`);
    }
    
    if (userContext.company_size) {
      contextParts.push(`Company: ${userContext.company_size}`);
    }
    
    if (userContext.top_challenges && userContext.top_challenges.length > 0) {
      contextParts.push(`Challenges: ${userContext.top_challenges.join(', ')}`);
    }
    
    if (userContext.personality_scores) {
      const topTraits = Object.entries(userContext.personality_scores)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([trait, score]) => `${trait}: ${Math.round((score as number) * 100)}%`)
        .join(', ');
      contextParts.push(`Top traits: ${topTraits}`);
    }
    
    const context = contextParts.join('. ');
    
    // Try Edge Functions first (preferred)
    try {
      const response = await fetch('https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId,
          context,
          count
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.prompts || data;
      }
      
      // If Edge Function doesn't exist, fall through to chat function
      console.log('🔄 Prompts Edge Function not found, trying chat function...');
      
    } catch (edgeFunctionError) {
      console.log('🔄 Edge Functions not available, trying chat function...', edgeFunctionError);
    }
    
    // Fallback: Use chat function to generate prompts
    const response = await fetch('https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        message: `Please generate exactly ${count} personalized coaching questions for a corporate professional. Context: ${context}. 

Requirements:
- Return ONLY the questions, no other text
- Format each question to start with "How do I", "What", "Where", "When", or "Why"
- Make them actionable and specific
- Each question should be under 60 characters
- Separate each question with a newline

Example format:
How do I build stronger stakeholder relationships?
What strategies help me influence without authority?
How do I improve my executive presence?`,
        isPromptGeneration: true // This tells the chat function to skip session creation
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('💥 Chat function error response:', errorText);
      throw new Error(`Backend request failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Extract prompts from chat response
    if (data.message) {
      console.log('📝 Raw AI response:', data.message);
      
      // Extract questions from text response (newline-separated format)
      const questions = data.message
        .split('\n')
        .map((line: string) => line.replace(/^[\d\.\-\s\*]+/, '').trim()) // Remove numbering
        .filter((line: string) => {
          // Filter for actual questions
          return line.includes('?') && 
                 line.length >= 10 && 
                 line.length <= 100 &&
                 (line.startsWith('How do I') || 
                  line.startsWith('What') || 
                  line.startsWith('Where') || 
                  line.startsWith('When') || 
                  line.startsWith('Why'));
        })
        .slice(0, count);
        
      console.log('🧹 Parsed questions:', questions);
      
      if (questions.length > 0) {
        return questions;
      }
      
      // Fallback: try JSON parsing
      try {
        const prompts = JSON.parse(data.message);
        if (Array.isArray(prompts)) {
          return prompts.slice(0, count);
        }
      } catch (parseError) {
        console.log('JSON parsing also failed, using fallback questions');
      }
    }
    
    throw new Error('Could not extract prompts from backend response');
    
  } catch (error) {
    console.error('💥 Error calling backend for prompts:', error);
    throw error;
  }
} 