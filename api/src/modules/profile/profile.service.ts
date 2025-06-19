import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateUUID } from '../../utils/uuid-validator.util';
import { getOpenAI } from '../../utils/openai';
import { 
  UserProfileDto, 
  UserPersonalizationDto,
  UpdateProfileDto,
  UpdatePersonalizationDto,
  CompleteProfileDto,
  GenerateAiPromptsDto
} from './dto/profile.dto';

@Injectable()
export class ProfileService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 
      'https://wdhmlynmbrhunizbdhdt.supabase.co';
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY') || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaG1seW5tYnJodW5pemJkaGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMDQ2NjgsImV4cCI6MjA2NDg4MDY2OH0.ORKN6Ryiz4Yo_BFhE_CS2yHMGPJDncKtYWKTwwI98N4';

    console.log('ProfileService: Initializing Supabase client with URL:', supabaseUrl);
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getProfile(userId: string): Promise<CompleteProfileDto> {
    // Validate UUID format
    validateUUID(userId, 'user_id');

    // Get user profile
    const { data: profileData, error: profileError } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', { code: profileError.code, message: profileError.message, details: profileError.details });
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    // Get user personalization
    const { data: personalizationData, error: personalizationError } = await this.supabase
      .from('user_personalization')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (personalizationError) {
      console.error('Personalization fetch error:', { code: personalizationError.code, message: personalizationError.message, details: personalizationError.details });
      throw new Error(`Failed to fetch personalization: ${personalizationError.message}`);
    }

    return {
      profile: profileData || { 
        id: '', 
        user_id: userId, 
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      },
      personalization: personalizationData || { 
        user_id: userId, 
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      },
      personality_scores: personalizationData?.personality_scores
    };
  }

  async updateProfile(userId: string, updateDto: UpdateProfileDto): Promise<UserProfileDto> {
    // Validate UUID format
    validateUUID(userId, 'user_id');

    const { data, error } = await this.supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        ...updateDto,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', { code: error.code, message: error.message, details: error.details });
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return data;
  }

  async updatePersonalization(
    userId: string, 
    updateDto: UpdatePersonalizationDto
  ): Promise<UserPersonalizationDto> {
    // Validate UUID format
    validateUUID(userId, 'user_id');

    // Use the database function for upsert
    const { data, error } = await this.supabase
      .rpc('fn_insert_or_update_personalization', {
        p_user_id: userId,
        p_current_position: updateDto.current_position,
        p_company_size: updateDto.company_size,
        p_primary_function: updateDto.primary_function,
        p_top_challenges: updateDto.top_challenges,
        p_preferred_coaching_style: updateDto.preferred_coaching_style,
        p_tier: updateDto.tier
      });

    if (error) {
      console.error('Personalization update error:', { code: error.code, message: error.message, details: error.details });
      throw new Error(`Failed to update personalization: ${error.message}`);
    }

    // Fetch the updated record
    const { data: updatedData, error: fetchError } = await this.supabase
      .from('user_personalization')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Personalization fetch error:', { code: fetchError.code, message: fetchError.message, details: fetchError.details });
      throw new Error(`Failed to fetch updated personalization: ${fetchError.message}`);
    }

    return updatedData;
  }

  async getPersonalityScores(userId: string): Promise<Record<string, number>> {
    // Validate UUID format
    validateUUID(userId, 'user_id');

    // TODO: Call fn_calculate_personality_scores function
    const { data, error } = await this.supabase
      .rpc('fn_calculate_personality_scores', {
        p_user_id: userId
      });

    if (error) {
      console.error('Personality scores calculation error:', { code: error.code, message: error.message, details: error.details });
      throw new Error(`Failed to calculate personality scores: ${error.message}`);
    }

    // Also get stored scores from user_personalization
    const { data: storedScores, error: fetchError } = await this.supabase
      .from('user_personalization')
      .select('personality_scores')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Stored personality scores fetch error:', { code: fetchError.code, message: fetchError.message, details: fetchError.details });
    }

    return storedScores?.personality_scores || data || {};
  }

  async getUserPersonalization(userId: string): Promise<UserPersonalizationDto | null> {
    // Validate UUID format
    validateUUID(userId, 'user_id');

    const { data, error } = await this.supabase
      .from('user_personalization')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('User personalization fetch error:', { code: error.code, message: error.message, details: error.details });
      throw new Error(`Failed to fetch personalization: ${error.message}`);
    }

    return data;
  }

  async savePersonalityScores(userId: string, saveDto: any): Promise<{ success: boolean; message: string }> {
    try {
      // Validate UUID format
      validateUUID(userId, 'user_id');
      
      // 🧪 TEST INSERT - Minimal write test to isolate the issue
      console.log('🧪 Starting test insert for user:', userId);
      const { data: testInsert, error: testError } = await this.supabase
        .from('user_personalization')
        .insert([{ user_id: userId, onboarding_status: 'testing' }]);
      console.log('🧪 TEST INSERT:', { testInsert, testError });
      
      if (testError) {
        console.error('🚨 Test insert failed:', testError);
        return {
          success: false,
          message: `Test insert failed: ${testError.message}`
        };
      }
      
      console.log('✅ Test insert succeeded, proceeding with main logic...');
      
      // Save individual quiz answers to onboarding_answers table
      console.log('💾 Saving individual quiz answers...');
      const answerPromises = Object.entries(saveDto.answers).map(([questionId, value]) => {
        return this.supabase
          .from('onboarding_answers')
          .upsert({
            user_id: userId,
            question_id: questionId,
            answer_value: value.toString(),
            answer_text: value.toString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      });

      await Promise.all(answerPromises);
      console.log('✅ Quiz answers saved successfully');

      // Prepare personalization data from onboarding
      const personalizationData = saveDto.personalizationData;
      
      // 🔧 FIXED: Prepare data to match ACTUAL database schema
      const updateData: any = {
        user_id: userId,
        onboarding_status: 'completed',
        personality_scores: saveDto.scores, // Store all scores as JSONB
        updated_at: new Date().toISOString() // Use correct column name
      };

      // Add onboarding data if available (only fields that exist in schema)
      if (personalizationData) {
        updateData.current_position = personalizationData.role;
        updateData.company_size = personalizationData.companySize;
        updateData.primary_function = personalizationData.function;
        updateData.top_challenges = personalizationData.challenges;
        updateData.preferred_coaching_style = personalizationData.personalityAnswers?.communication_style || null;
      }

      console.log('💾 Saving user personalization data:', updateData);

      // Update user_personalization directly with correct schema
      const { error: updateError } = await this.supabase
        .from('user_personalization')
        .upsert(updateData);

      if (updateError) {
        console.error('🚨 User personalization update failed:', updateError);
        throw new Error(`Failed to update personality scores: ${updateError.message}`);
      }

      console.log('✅ User personalization saved successfully');

      return {
        success: true,
        message: 'Personality scores and onboarding data saved successfully'
      };
    } catch (error) {
      console.error('💥 Error saving personality scores:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save personality scores: ${errorMessage}`);
    }
  }

  async generateAiPrompts(userId: string, dto: GenerateAiPromptsDto): Promise<{ prompts: string[] }> {
    console.log('🚀 Starting AI prompt generation for user:', userId);
    
    try {
      // Validate UUID format
      validateUUID(userId, 'user_id');

      // Get user personalization data to enrich the prompt
      const profile = await this.getUserPersonalization(userId);
      console.log('📋 User profile for AI context:', profile);

      // Build system prompt based on user data
      const systemPromptParts = [
        'You are a corporate influence coach. Generate coaching prompt suggestions based on the following user profile:'
      ];

      if (profile?.current_position) {
        systemPromptParts.push(`Role: ${profile.current_position}`);
      }

      if (profile?.primary_function) {
        systemPromptParts.push(`Function: ${profile.primary_function}`);
      }

      if (profile?.top_challenges && profile.top_challenges.length > 0) {
        systemPromptParts.push(`Challenges: ${profile.top_challenges.join(', ')}`);
      }

      if (profile?.personality_scores) {
        systemPromptParts.push(`Personality scores: ${JSON.stringify(profile.personality_scores)}`);
      }

      if (profile?.preferred_coaching_style) {
        systemPromptParts.push(`Preferred coaching style: ${profile.preferred_coaching_style}`);
      }

      systemPromptParts.push(
        `Generate exactly ${dto.count} concise, actionable coaching prompt suggestions.`,
        'Each prompt should be a question that helps the user develop their corporate influence skills.',
        'Return the response as a JSON array of strings, like: ["Prompt 1", "Prompt 2", ...]',
        'Focus on practical, specific questions they can act on immediately.'
      );

      const systemPrompt = systemPromptParts.join('\n');
      const userPrompt = `Context: ${dto.context}\n\nPlease generate ${dto.count} personalized coaching prompts for this user.`;

      console.log('📝 System prompt:', systemPrompt);
      console.log('📝 User prompt:', userPrompt);

      // Call OpenAI
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
        max_tokens: 1000,
      });

      const responseText = completion.choices[0].message?.content?.trim();
      console.log('🤖 OpenAI response:', responseText);

      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Try to parse as JSON array
      let prompts: string[];
      try {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed)) {
          prompts = parsed;
        } else if (parsed.prompts && Array.isArray(parsed.prompts)) {
          prompts = parsed.prompts;
        } else {
          throw new Error('Response is not an array');
        }
      } catch (parseError) {
        console.log('⚠️ Failed to parse as JSON, trying line-based parsing...');
        // Fallback: split by newlines and clean up
        prompts = responseText
          .split('\n')
          .map(line => line.replace(/^[\d\.\-\s\*]+/, '').trim()) // Remove numbering, bullets, etc.
          .filter(line => line.length > 10) // Filter out short/empty lines
          .slice(0, dto.count); // Ensure we don't exceed requested count
      }

      // Ensure we have the right number of prompts
      if (prompts.length < dto.count) {
        console.log(`⚠️ Generated ${prompts.length} prompts, but ${dto.count} were requested. Adding fallbacks...`);
        
        const fallbackPrompts = [
          "How can I build stronger relationships with key stakeholders?",
          "What's the best way to present ideas to senior leadership?",
          "How do I navigate competing priorities effectively?",
          "What strategies help me influence without authority?",
          "How can I improve my executive presence in meetings?",
          "What's the most effective way to handle pushback on my proposals?",
          "How do I build consensus among diverse team members?",
          "What techniques help me communicate complex ideas simply?",
          "How can I increase my visibility in the organization?",
          "What's the best approach to managing up effectively?"
        ];

        // Add fallbacks until we reach the desired count
        while (prompts.length < dto.count && fallbackPrompts.length > 0) {
          const fallback = fallbackPrompts.shift();
          if (fallback && !prompts.includes(fallback)) {
            prompts.push(fallback);
          }
        }
      }

      // Trim to exact count requested
      prompts = prompts.slice(0, dto.count);

      console.log('✅ Final prompts:', prompts);

      return { prompts };

    } catch (error) {
      console.error('❌ Error generating AI prompts:', error);
      
      // Return fallback prompts on error
      const fallbackPrompts = [
        "How can I build stronger relationships with key stakeholders?",
        "What's the best way to present ideas to senior leadership?",
        "How do I navigate competing priorities effectively?",
        "What strategies help me influence without authority?",
        "How can I improve my executive presence in meetings?"
      ];

      return { 
        prompts: fallbackPrompts.slice(0, dto.count)
      };
    }
  }

  async generateQuizSummary(userId: string): Promise<{ summary: string }> {
    console.log('🚀 Starting quiz summary generation for user:', userId);
    
    try {
      // Validate UUID format
      validateUUID(userId, 'user_id');

      // 1. Load personalization row
      const personalization = await this.getUserPersonalization(userId);
      console.log('📋 User personalization data:', personalization);

      if (!personalization) {
        throw new Error('User personalization data not found');
      }

      // 2. Load all onboarding_answers for this user
      const { data: answers, error: answersError } = await this.supabase
        .from('onboarding_answers')
        .select('question_id, answer_value, answer_text')
        .eq('user_id', userId);

      if (answersError) {
        console.error('Error fetching onboarding answers:', answersError);
        throw new Error(`Failed to fetch onboarding answers: ${answersError.message}`);
      }

      console.log('📝 Onboarding answers:', answers);

      // 3. Build context from personalization and answers
      const contextParts = [];

      // Add personalization data
      if (personalization.current_position) {
        contextParts.push(`Role: ${personalization.current_position}`);
      }

      if (personalization.primary_function) {
        contextParts.push(`Function: ${personalization.primary_function}`);
      }

      if (personalization.top_challenges && personalization.top_challenges.length > 0) {
        contextParts.push(`Challenges: ${personalization.top_challenges.join(', ')}`);
      }

      if (personalization.preferred_coaching_style) {
        contextParts.push(`Coaching Style: ${personalization.preferred_coaching_style}`);
      }

      if (personalization.company_size) {
        contextParts.push(`Company Size: ${personalization.company_size}`);
      }

      // Add personality scores if available
      if (personalization.personality_scores) {
        const scores = personalization.personality_scores;
        const topTraits = Object.entries(scores)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([trait, score]) => `${trait}: ${score}`)
          .join(', ');
        contextParts.push(`Top Personality Traits: ${topTraits}`);
      }

      // Add quiz answers
      if (answers && answers.length > 0) {
        contextParts.push('Quiz Responses:');
        answers.forEach((answer, index) => {
          const responseText = answer.answer_text || answer.answer_value || 'No response';
          contextParts.push(`Q${index + 1}: ${responseText}`);
        });
      }

      const context = contextParts.join('\n');
      console.log('📄 Built context:', context);

      // 4. Build system prompt
      const systemPrompt = `You are a corporate coach. Create a concise professional summary of this user's profile and quiz responses. 

Requirements:
- Maximum 280 characters (like a tweet)
- Focus on their role, key strengths, and main development areas
- Use professional, coaching-oriented language
- Make it actionable and insightful

User Profile:`;

      const fullPrompt = `${systemPrompt}\n\n${context}`;
      console.log('📝 Full prompt for OpenAI:', fullPrompt);

      // 5. Call OpenAI
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context }
        ],
        temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
        max_tokens: 100, // Keep it short for 280 char limit
      });

      const rawSummary = completion.choices[0].message?.content?.trim();
      console.log('🤖 OpenAI raw response:', rawSummary);

      if (!rawSummary) {
        throw new Error('Empty response from OpenAI');
      }

      // 6. Ensure summary is under 300 characters
      const summary = rawSummary.slice(0, 300);
      console.log('✂️ Trimmed summary:', summary, `(${summary.length} chars)`);

      // 7. Persist summary in user_personalization
      const { error: updateError } = await this.supabase
        .from('user_personalization')
        .update({ 
          quiz_summary: summary,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating quiz summary:', updateError);
        throw new Error(`Failed to save quiz summary: ${updateError.message}`);
      }

      console.log('✅ Quiz summary saved successfully');

      return { summary };

    } catch (error) {
      console.error('❌ Error generating quiz summary:', error);
      
      // Generate a fallback summary based on available data
      const fallbackSummary = await this.generateFallbackSummary(userId);
      
      // Try to save the fallback summary
      try {
        await this.supabase
          .from('user_personalization')
          .update({ 
            quiz_summary: fallbackSummary,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } catch (saveError) {
        console.error('Failed to save fallback summary:', saveError);
      }

      return { summary: fallbackSummary };
    }
  }

  private async generateFallbackSummary(userId: string): Promise<string> {
    try {
      const personalization = await this.getUserPersonalization(userId);
      
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
  }

  async generatePersonaSummary(userId: string): Promise<{ summary: string }> {
    console.log('🎭 Starting persona summary generation for user:', userId);
    
    try {
      // Validate UUID format
      validateUUID(userId, 'user_id');

      // Fetch comprehensive user data
      const personalization = await this.getUserPersonalization(userId);
      console.log('📋 User personalization data:', personalization);

      if (!personalization) {
        throw new Error('User personalization data not found');
      }

      // Extract data for template interpolation
      const role = personalization.current_position || 'Professional';
      const companySize = personalization.company_size || 'mid-sized';
      const primaryFunction = personalization.primary_function || 'their department';
      const challenges = personalization.top_challenges?.join(', ') || 'strategic communication and influence';

      // Extract personality answers from metadata
      const personalityAnswers = personalization.metadata?.personalityAnswers || {};
      const communicationStyle = personalityAnswers.communication_style || 'directly and clearly';
      const conflictApproach = personalityAnswers.conflict_approach || 'addressing issues head-on';
      const decisionMaking = personalityAnswers.decision_making || 'data-driven analysis';

      // Extract personality scores (convert to percentages)
      const personalityScores = personalization.personality_scores || {};
      const assertiveness = Math.round((personalityScores.assertiveness || 0.5) * 100);
      const strategic = Math.round((personalityScores.strategic || 0.5) * 100);
      const adaptability = Math.round((personalityScores.adaptability || 0.5) * 100);
      const empathy = Math.round((personalityScores.empathy || 0.5) * 100);
      const conscientiousness = Math.round((personalityScores.conscientiousness || 0.5) * 100);
      const integrity = Math.round((personalityScores.integrity || 0.5) * 100);

      // Generate rich persona summary using the template
      const personaSummary = `As a ${role} leading ${primaryFunction} in a ${companySize}-person firm, you communicate ${communicationStyle}, tackle conflict by ${conflictApproach}, and decide via ${decisionMaking}. You face challenges like ${challenges}. Your trait scores are: Assertiveness ${assertiveness}%, Strategic ${strategic}%, Adaptability ${adaptability}%, Empathy ${empathy}%, Conscientiousness ${conscientiousness}%, Integrity ${integrity}%.`;

      console.log('🎭 Generated persona summary:', personaSummary);
      console.log('📏 Summary length:', personaSummary.length, 'characters');

      // Ensure summary is under 500 characters as requested
      let finalSummary = personaSummary;
      if (personaSummary.length > 500) {
        console.log('✂️ Trimming summary to 500 characters...');
        finalSummary = personaSummary.slice(0, 497) + '...';
      }

      // Save to database
      const { error: updateError } = await this.supabase
        .from('user_personalization')
        .update({ 
          quiz_summary: finalSummary,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating persona summary:', updateError);
        throw new Error(`Failed to save persona summary: ${updateError.message}`);
      }

      console.log('✅ Persona summary saved successfully');

      return { summary: finalSummary };

    } catch (error) {
      console.error('❌ Error generating persona summary:', error);
      
      // Generate a fallback persona summary
      const fallbackSummary = await this.generateFallbackPersonaSummary(userId);
      
      // Try to save the fallback summary
      try {
        await this.supabase
          .from('user_personalization')
          .update({ 
            quiz_summary: fallbackSummary,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } catch (saveError) {
        console.error('Failed to save fallback persona summary:', saveError);
      }

      return { summary: fallbackSummary };
    }
  }

  private async generateFallbackPersonaSummary(userId: string): Promise<string> {
    try {
      const personalization = await this.getUserPersonalization(userId);
      
      if (!personalization) {
        return "As a Professional in a mid-sized firm, you communicate directly, tackle conflict by addressing issues head-on, and decide via data-driven analysis. You face challenges like strategic communication and influence. Your trait scores are: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%.";
      }

      const role = personalization.current_position || 'Professional';
      const companySize = personalization.company_size || 'mid-sized';
      const primaryFunction = personalization.primary_function || 'their department';
      const challenges = personalization.top_challenges?.slice(0, 2).join(', ') || 'strategic communication and influence';

      // Use default personality scores if not available
      const fallbackSummary = `As a ${role} leading ${primaryFunction} in a ${companySize}-person firm, you communicate directly and clearly, tackle conflict by addressing issues head-on, and decide via data-driven analysis. You face challenges like ${challenges}. Your trait scores are: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%.`;

      return fallbackSummary.slice(0, 500);
      
    } catch (error) {
      console.error('Error generating fallback persona summary:', error);
      return "As a Professional in a mid-sized firm, you communicate directly, tackle conflict by addressing issues head-on, and decide via data-driven analysis. You face challenges like strategic communication and influence. Your trait scores are: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%.";
    }
  }

  async generateCorporateSummary(userId: string): Promise<{ summary: string }> {
    console.log('🏢 Starting corporate summary generation for user:', userId);
    
    try {
      // Validate UUID format
      validateUUID(userId, 'user_id');

      // Fetch comprehensive user data
      const personalization = await this.getUserPersonalization(userId);
      console.log('📋 User personalization data:', personalization);

      if (!personalization) {
        throw new Error('User personalization data not found');
      }

      // Fetch onboarding answers for personality insights
      const { data: answers, error: answersError } = await this.supabase
        .from('onboarding_answers')
        .select('question_code, answer_value')
        .eq('user_id', userId);

      if (answersError) {
        console.error('Error fetching onboarding answers:', answersError);
      }

      console.log('📝 Onboarding answers:', answers);

      // Extract data for template interpolation
      const role = personalization.current_position || 'Professional';
      const primaryFunction = personalization.primary_function || 'their department';
      const companySize = personalization.company_size || 'mid-sized';
      const challenges = personalization.top_challenges?.join(', ') || 'strategic communication and influence';

      // Extract personality answers from metadata
      const personalityAnswers = personalization.metadata?.personalityAnswers || {};
      const communicationStyle = personalityAnswers.communication_style || 'directly and clearly';
      const conflictApproach = personalityAnswers.conflict_approach || 'addressing issues head-on';
      const decisionMaking = personalityAnswers.decision_making || 'data-driven analysis';

      // Extract personality scores (convert to percentages)
      const personalityScores = personalization.personality_scores || {};
      const assertiveness = Math.round((personalityScores.assertiveness || 0.5) * 100);
      const strategic = Math.round((personalityScores.strategic || 0.5) * 100);
      const adaptability = Math.round((personalityScores.adaptability || 0.5) * 100);
      const empathy = Math.round((personalityScores.empathy || 0.5) * 100);
      const conscientiousness = Math.round((personalityScores.conscientiousness || 0.5) * 100);
      const integrity = Math.round((personalityScores.integrity || 0.5) * 100);

      // Build the corporate persona template
      const corporateTemplate = `${role} in ${primaryFunction} at a ${companySize}-person firm. Communication: ${communicationStyle}. Conflict: ${conflictApproach}. Decision-making: ${decisionMaking}. Personality scores: Assertiveness ${assertiveness}%, Strategic ${strategic}%, Adaptability ${adaptability}%, Empathy ${empathy}%, Conscientiousness ${conscientiousness}%, Integrity ${integrity}%. Challenges: ${challenges}. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.`;

      console.log('📋 Corporate template built:', corporateTemplate);
      console.log('📏 Template length:', corporateTemplate.length, 'characters');

      // Call OpenAI to tighten and polish the summary
      const openai = getOpenAI();
      
      const systemPrompt = `You are a corporate communications expert. Take the following corporate persona template and refine it into a polished, professional summary that is exactly 500 characters or less. Keep all the key information but make it more concise and impactful. Maintain the professional tone and ensure it flows naturally.

Template to refine: ${corporateTemplate}

Requirements:
- Maximum 500 characters
- Professional and polished tone
- Keep all key personality scores and information
- Make it flow naturally
- Focus on corporate influence and leadership

Return only the refined summary, no additional text.`;

      console.log('🤖 Calling OpenAI to refine corporate summary...');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ],
        max_tokens: 200,
        temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
      });

      let aiSummary = completion.choices[0]?.message?.content?.trim();

      if (!aiSummary) {
        console.warn('⚠️ OpenAI returned empty response, using template');
        aiSummary = corporateTemplate;
      }

      console.log('🤖 OpenAI refined summary:', aiSummary);
      console.log('📏 AI summary length:', aiSummary.length, 'characters');

      // Ensure summary is under 500 characters
      let finalSummary = aiSummary;
      if (aiSummary.length > 500) {
        console.log('✂️ Trimming AI summary to 500 characters...');
        finalSummary = aiSummary.slice(0, 497) + '...';
      }

      // Save to database
      const { error: updateError } = await this.supabase
        .from('user_personalization')
        .update({ 
          quiz_summary: finalSummary,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating corporate summary:', updateError);
        throw new Error(`Failed to save corporate summary: ${updateError.message}`);
      }

      console.log('✅ Corporate summary saved successfully');

      return { summary: finalSummary };

    } catch (error) {
      console.error('❌ Error generating corporate summary:', error);
      
      // Generate a fallback corporate summary
      const fallbackSummary = await this.generateFallbackCorporateSummary(userId);
      
      // Try to save the fallback summary
      try {
        await this.supabase
          .from('user_personalization')
          .update({ 
            quiz_summary: fallbackSummary,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } catch (saveError) {
        console.error('Failed to save fallback corporate summary:', saveError);
      }

      return { summary: fallbackSummary };
    }
  }

  private async generateFallbackCorporateSummary(userId: string): Promise<string> {
    try {
      const personalization = await this.getUserPersonalization(userId);
      
      if (!personalization) {
        return "Professional in their department at a mid-sized firm. Communication: directly and clearly. Conflict: addressing issues head-on. Decision-making: data-driven analysis. Personality scores: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%. Challenges: strategic communication and influence. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.";
      }

      const role = personalization.current_position || 'Professional';
      const primaryFunction = personalization.primary_function || 'their department';
      const companySize = personalization.company_size || 'mid-sized';
      const challenges = personalization.top_challenges?.slice(0, 2).join(', ') || 'strategic communication and influence';

      // Use default personality answers if not available
      const fallbackSummary = `${role} in ${primaryFunction} at a ${companySize}-person firm. Communication: directly and clearly. Conflict: addressing issues head-on. Decision-making: data-driven analysis. Personality scores: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%. Challenges: ${challenges}. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.`;

      return fallbackSummary.slice(0, 500);
      
    } catch (error) {
      console.error('Error generating fallback corporate summary:', error);
      return "Professional in their department at a mid-sized firm. Communication: directly and clearly. Conflict: addressing issues head-on. Decision-making: data-driven analysis. Personality scores: Assertiveness 50%, Strategic 50%, Adaptability 50%, Empathy 50%, Conscientiousness 50%, Integrity 50%. Challenges: strategic communication and influence. Aspiration: Leverage strengths to influence stakeholders, lead with integrity, and drive results under pressure.";
    }
  }
} 