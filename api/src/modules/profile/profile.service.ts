import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

  constructor() {
    // TODO: Move to config service
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }

  async getProfile(userId: string): Promise<CompleteProfileDto> {
    // Get user profile
    const { data: profileData, error: profileError } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // Not found is OK
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    // Get user personalization
    const { data: personalizationData, error: personalizationError } = await this.supabase
      .from('user_personalization')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (personalizationError && personalizationError.code !== 'PGRST116') {
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
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return data;
  }

  async updatePersonalization(
    userId: string, 
    updateDto: UpdatePersonalizationDto
  ): Promise<UserPersonalizationDto> {
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
      throw new Error(`Failed to update personalization: ${error.message}`);
    }

    // Fetch the updated record
    const { data: updatedData, error: fetchError } = await this.supabase
      .from('user_personalization')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch updated personalization: ${fetchError.message}`);
    }

    return updatedData;
  }

  async getPersonalityScores(userId: string): Promise<Record<string, number>> {
    // TODO: Call fn_calculate_personality_scores function
    const { data, error } = await this.supabase
      .rpc('fn_calculate_personality_scores', {
        p_user_id: userId
      });

    if (error) {
      throw new Error(`Failed to calculate personality scores: ${error.message}`);
    }

    // Also get stored scores from user_personalization
    const { data: storedScores } = await this.supabase
      .from('user_personalization')
      .select('personality_scores')
      .eq('user_id', userId)
      .single();

    return storedScores?.personality_scores || data || {};
  }

  async getUserPersonalization(userId: string): Promise<UserPersonalizationDto | null> {
    const { data, error } = await this.supabase
      .from('user_personalization')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch personalization: ${error.message}`);
    }

    return data;
  }
} 