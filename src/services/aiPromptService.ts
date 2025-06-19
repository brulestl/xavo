import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

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

interface OnboardingAnswer {
  question_id: string;
  answer_value: string;
  answer_text?: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function generateAiPrompts(userId: string, count = 5): Promise<string[]> {
  console.log(`🤖 Generating ${count} AI prompts for user ${userId}`);
  
  // 🔥 CRITICAL: Check for OpenAI API key - ERROR LOUDLY IF MISSING
  const extra = Constants.expoConfig?.extra || {};
  // Try multiple sources for the API key, including direct manifest access
  const openaiApiKey = extra.openaiApiKey ?? 
                      Constants.manifest?.extra?.openaiApiKey ?? 
                      Constants.manifest2?.extra?.expoClient?.extra?.openaiApiKey ??
                      process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? 
                      process.env.OPENAI_API_KEY ??
                      // Fallback for web development
                      (typeof window !== 'undefined' && (window as any).__EXPO_ENV__?.openaiApiKey);
  
  // Debug API key detection
  console.log('🔑 OpenAI API key detected:', openaiApiKey ? `${openaiApiKey.substring(0, 10)}...` : 'NOT FOUND');
  
  if (!openaiApiKey) {
    const errorMessage = '🚨 OPENAI_API_KEY is UNDEFINED! Set it in app.json extra.openaiApiKey or as EXPO_PUBLIC_OPENAI_API_KEY environment variable.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  console.log('🔑 OpenAI API key found, proceeding with AI prompt generation');
  
  try {
    // 📊 Fetch the user's COMPLETE profile from Supabase
    const userContext = await fetchUserProfileContext(userId);
    console.log('👤 User context built:', userContext);
    
    // 🎯 Build the OpenAI prompt
    const { systemPrompt, userPrompt } = buildOpenAIPrompts(userContext, count);
    
    // 🤖 Call OpenAI Chat Completions API
    const aiQuestions = await callOpenAIChatAPI(openaiApiKey, systemPrompt, userPrompt);
    
    // ✅ Validate we got exactly the right number of unique questions
    validateAIQuestions(aiQuestions, count);
    
    console.log('✅ Successfully generated dynamic AI prompts:', aiQuestions);
    return aiQuestions;
    
  } catch (error) {
    const errorMessage = `💥 AI prompt generation FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
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
    
    // Get onboarding answers for additional context
    const { data: answersData, error: answersError } = await supabase
      .from('onboarding_answers')
      .select('question_id, answer_value')
      .eq('user_id', userId);
      
    if (answersError) {
      console.warn('⚠️ Could not fetch onboarding answers:', answersError.message);
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

function buildOpenAIPrompts(userContext: UserProfileData, count: number): { systemPrompt: string; userPrompt: string } {
  const role = userContext.current_position || 'Professional';
  const primaryFunction = userContext.primary_function || 'their department';
  const companySize = userContext.company_size || 'mid-sized organization';
  const challenges = userContext.top_challenges?.join(', ') || 'strategic communication and influence';
  
  // Extract personality insights
  const personalityScores = userContext.personality_scores || {};
  const personalityAnswers = userContext.metadata?.personalityAnswers || {};
  
  const assertiveness = Math.round((personalityScores.assertiveness || 0.5) * 100);
  const strategic = Math.round((personalityScores.strategic || 0.5) * 100);
  const adaptability = Math.round((personalityScores.adaptability || 0.5) * 100);
  const empathy = Math.round((personalityScores.empathy || 0.5) * 100);
  const conscientiousness = Math.round((personalityScores.conscientiousness || 0.5) * 100);
  const integrity = Math.round((personalityScores.integrity || 0.5) * 100);
  
  const communicationStyle = personalityAnswers.communication_style || 'direct communication';
  const conflictApproach = personalityAnswers.conflict_approach || 'addressing issues directly';
  const decisionMaking = personalityAnswers.decision_making || 'analytical decision-making';
  
  const systemPrompt = `You are an expert corporate influence coach. Generate exactly ${count} personalized coaching questions for a professional seeking to enhance their corporate influence and leadership effectiveness.

CRITICAL: Respond with ONLY a valid JSON array of exactly ${count} unique question strings. No additional text, explanations, or formatting.

QUESTION REQUIREMENTS:
- Use FIRST PERSON ("How do I..." not "How can you...")
- Keep questions CONCISE (max 60 characters)
- Start with action words: "How do I", "What", "Where", "When", "Why"
- End with question marks
- Be specific and actionable

Example format: ["How do I prepare for difficult conversations?", "What tactics help me influence stakeholders?", "How do I build executive presence?"]`;

  const userPrompt = `Generate ${count} personalized coaching questions for this professional:

ROLE & CONTEXT:
- Position: ${role}
- Function: ${primaryFunction}
- Company: ${companySize}
- Top challenges: ${challenges}

PERSONALITY PROFILE:
- Communication style: ${communicationStyle}
- Conflict approach: ${conflictApproach}
- Decision making: ${decisionMaking}
- Assertiveness: ${assertiveness}%
- Strategic thinking: ${strategic}%
- Adaptability: ${adaptability}%
- Empathy: ${empathy}%
- Conscientiousness: ${conscientiousness}%
- Integrity: ${integrity}%

Create questions that:
1. Address their specific challenges (${challenges})
2. Align with their communication style (${communicationStyle})
3. Leverage their personality strengths
4. Help them influence without authority
5. Build executive presence and stakeholder relationships

Each question should be:
- FIRST PERSON format ("How do I..." not "How can you...")
- Specific to their context and challenges
- Actionable and coaching-focused
- Maximum 60 characters for mobile screens
- Professional but conversational tone`;

  console.log('🎯 Built OpenAI prompts:', { systemPrompt, userPrompt });
  return { systemPrompt, userPrompt };
}

function cleanPrompt(prompt: string): string {
  console.log('🧹 Cleaning prompt:', prompt);
  
  // Step 1: Convert second-person to first-person
  let cleaned = prompt
    // Replace "How can you" with "How do I"
    .replace(/^How can you\b/i, 'How do I')
    // Replace "What can you" with "What can I"
    .replace(/^What can you\b/i, 'What can I')
    // Replace "How do you" with "How do I"
    .replace(/^How do you\b/i, 'How do I')
    // Replace "What do you" with "What do I"
    .replace(/^What do you\b/i, 'What do I')
    // Replace "Where can you" with "Where can I"
    .replace(/^Where can you\b/i, 'Where can I')
    // Replace "When can you" with "When can I"
    .replace(/^When can you\b/i, 'When can I')
    // Replace "Why can you" with "Why can I"
    .replace(/^Why can you\b/i, 'Why can I')
    // Replace remaining "you" with "I" (but be careful with context)
    .replace(/\byou\b/gi, 'I')
    // Fix "your" to "my"
    .replace(/\byour\b/gi, 'my');

  // Step 2: Standardize question format
  if (!cleaned.startsWith('How do I') && !cleaned.startsWith('What') && !cleaned.startsWith('Where') && !cleaned.startsWith('When') && !cleaned.startsWith('Why')) {
    // If it doesn't start with a question word, try to make it "How do I"
    cleaned = `How do I ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }

  // Step 3: Enforce maximum character length (65 characters)
  const maxLength = 65;
  if (cleaned.length > maxLength) {
    // Find the last complete word before the limit
    const truncated = cleaned.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      cleaned = truncated.substring(0, lastSpaceIndex) + '…';
    } else {
      // If no space found, just truncate at limit
      cleaned = truncated + '…';
    }
  }

  // Step 4: Ensure it ends with a question mark
  if (!cleaned.endsWith('?') && !cleaned.endsWith('…')) {
    cleaned += '?';
  }

  console.log('✨ Cleaned result:', cleaned);
  return cleaned;
}

async function callOpenAIChatAPI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string[]> {
  console.log('🚀 Calling OpenAI Chat Completions API (gpt-4o-mini)...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('💥 OpenAI API error response:', errorData);
      throw new Error(`OpenAI API request failed (${response.status}): ${errorData}`);
    }

    console.log('✅ OpenAI API responded successfully');
    const data: OpenAIResponse = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response structure from OpenAI API');
    }

    const content = data.choices[0].message.content.trim();
    console.log('📝 Raw OpenAI response content:', content);
    
    // Parse the JSON response
    let questions: string[];
    try {
      questions = JSON.parse(content);
      console.log('✅ Successfully parsed questions:', questions);
    } catch (parseError) {
      console.error('💥 JSON parse error:', parseError);
      throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
    }
    
    if (!Array.isArray(questions)) {
      throw new Error(`OpenAI response is not an array: ${typeof questions}`);
    }
    
    // 🔄 Post-process: Convert to first-person and enforce character limits
    const cleanedQuestions = questions.map(q => cleanPrompt(String(q).trim()));
    console.log('🧹 Cleaned questions:', cleanedQuestions);
    
    return cleanedQuestions;
  } catch (error) {
    console.error('💥 Error in callOpenAIChatAPI:', error);
    throw error;
  }
}

function validateAIQuestions(questions: string[], expectedCount: number): void {
  console.log('🔍 Validating AI questions...');
  
  if (!Array.isArray(questions)) {
    throw new Error(`Expected array of questions, got ${typeof questions}`);
  }
  
  if (questions.length !== expectedCount) {
    throw new Error(`Expected exactly ${expectedCount} questions, got ${questions.length}`);
  }
  
  // Check for empty questions
  const emptyQuestions = questions.filter(q => !q || q.trim().length === 0);
  if (emptyQuestions.length > 0) {
    throw new Error(`Found ${emptyQuestions.length} empty questions`);
  }
  
  // Check for duplicate questions
  const uniqueQuestions = new Set(questions.map(q => q.trim().toLowerCase()));
  if (uniqueQuestions.size !== questions.length) {
    throw new Error(`Found duplicate questions - expected ${questions.length} unique, got ${uniqueQuestions.size} unique`);
  }
  
  // Check question length (should be concise mobile-friendly questions)
  const tooShort = questions.filter(q => q.trim().length < 10);
  const tooLong = questions.filter(q => q.trim().length > 70); // Updated for mobile-friendly limit
  
  if (tooShort.length > 0) {
    throw new Error(`Found ${tooShort.length} questions that are too short (< 10 chars)`);
  }
  
  if (tooLong.length > 0) {
    throw new Error(`Found ${tooLong.length} questions that are too long (> 70 chars)`);
  }
  
  console.log('✅ All AI questions validated successfully');
} 