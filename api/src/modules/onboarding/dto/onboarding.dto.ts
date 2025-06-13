import { IsUUID, IsString, IsArray, IsOptional, IsEnum, IsObject } from 'class-validator';

// Onboarding Question DTO
export class OnboardingQuestionDto {
  @IsUUID()
  id: string;

  @IsString()
  question_code: string;

  @IsEnum(['personalization', 'personality'])
  question_type: 'personalization' | 'personality';

  @IsString()
  prompt: string;

  @IsEnum(['single-select', 'multi-select', 'likert'])
  input_type: 'single-select' | 'multi-select' | 'likert';

  @IsArray()
  choices: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  display_order: number;

  created_at: string;
}

// Create Onboarding Answer DTO
export class CreateOnboardingAnswerDto {
  @IsUUID()
  question_id: string;

  @IsString()
  answer_value: string;

  @IsOptional()
  @IsObject()
  answer_metadata?: Record<string, any>;
}

// Onboarding Answer Response DTO
export class OnboardingAnswerDto {
  @IsUUID()
  id: string;

  @IsUUID()
  user_id: string;

  @IsUUID()
  question_id: string;

  @IsString()
  answer_value: string;

  @IsOptional()
  @IsObject()
  answer_metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// Complete Onboarding DTO
export class CompleteOnboardingDto {
  @IsArray()
  answers: CreateOnboardingAnswerDto[];
}

// Onboarding Status Response DTO
export class OnboardingStatusDto {
  @IsString()
  status: 'not_started' | 'in_progress' | 'completed';

  completed_questions: number;
  total_questions: number;
  
  @IsOptional()
  personality_scores?: Record<string, number>;
} 