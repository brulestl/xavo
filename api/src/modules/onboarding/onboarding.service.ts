import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateUUID } from '../../utils/uuid-validator.util';
import { 
  OnboardingQuestionDto, 
  CreateOnboardingAnswerDto, 
  CompleteOnboardingDto,
  OnboardingStatusDto,
  OnboardingAnswerDto
} from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  private supabase: SupabaseClient;

  constructor() {
    // TODO: Move to config service
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }

  async getQuestions(): Promise<OnboardingQuestionDto[]> {
    const { data, error } = await this.supabase
      .from('onboarding_questions')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch questions: ${error.message}`);
    }

    return data || [];
  }

  async submitAnswer(
    userId: string, 
    createAnswerDto: CreateOnboardingAnswerDto
  ): Promise<{ success: boolean; message: string }> {
    // Validate UUID format
    validateUUID(userId, 'user_id');
    const { data, error } = await this.supabase
      .from('onboarding_answers')
      .upsert({
        user_id: userId,
        question_id: createAnswerDto.question_id,
        answer_value: createAnswerDto.answer_value,
        answer_metadata: createAnswerDto.answer_metadata || {},
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      throw new Error(`Failed to submit answer: ${error.message}`);
    }

    return {
      success: true,
      message: 'Answer submitted successfully'
    };
  }

  async completeOnboarding(
    userId: string, 
    completeDto: CompleteOnboardingDto
  ): Promise<OnboardingStatusDto> {
    // Validate UUID format
    validateUUID(userId, 'user_id');
    // Submit all answers in a transaction-like manner
    const answerPromises = completeDto.answers.map(answer => 
      this.submitAnswer(userId, answer)
    );

    await Promise.all(answerPromises);

    // Update user personalization status
    const { error: updateError } = await this.supabase
      .rpc('fn_insert_or_update_personalization', {
        p_user_id: userId,
        p_onboarding_status: 'completed'
      });

    if (updateError) {
      throw new Error(`Failed to update onboarding status: ${updateError.message}`);
    }

    // Calculate personality scores
    // TODO: Call fn_calculate_personality_scores function
    const { data: personalityData, error: personalityError } = await this.supabase
      .rpc('fn_calculate_personality_scores', {
        p_user_id: userId
      });

    if (personalityError) {
      console.warn(`Failed to calculate personality scores: ${personalityError.message}`);
    }

    return this.getOnboardingStatus(userId);
  }

  async getOnboardingStatus(userId: string): Promise<OnboardingStatusDto> {
    // Validate UUID format
    validateUUID(userId, 'user_id');
    // Get total questions count
    const { count: totalQuestions } = await this.supabase
      .from('onboarding_questions')
      .select('*', { count: 'exact', head: true });

    // Get completed answers count
    const { count: completedQuestions } = await this.supabase
      .from('onboarding_answers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get user personalization data
    const { data: personalizationData, error: personalizationError } = await this.supabase
      .from('user_personalization')
      .select('onboarding_status, personality_scores')
      .eq('user_id', userId)
      .maybeSingle();

    if (personalizationError) {
      console.error('Personalization fetch error:', { code: personalizationError.code, message: personalizationError.message, details: personalizationError.details });
    }

    const status = personalizationData?.onboarding_status || 
      (completedQuestions === 0 ? 'not_started' : 'in_progress');

    return {
      status: status as 'not_started' | 'in_progress' | 'completed',
      completed_questions: completedQuestions || 0,
      total_questions: totalQuestions || 0,
      personality_scores: personalizationData?.personality_scores || undefined
    };
  }

  async getUserAnswers(userId: string): Promise<OnboardingAnswerDto[]> {
    // Validate UUID format
    validateUUID(userId, 'user_id');
    const { data, error } = await this.supabase
      .from('onboarding_answers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch user answers: ${error.message}`);
    }

    return data || [];
  }
} 