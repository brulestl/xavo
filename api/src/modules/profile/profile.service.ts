import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateUUID } from '../../utils/uuid-validator.util';
import { 
  UserProfileDto, 
  UserPersonalizationDto,
  UpdateProfileDto,
  UpdatePersonalizationDto,
  CompleteProfileDto
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
} 