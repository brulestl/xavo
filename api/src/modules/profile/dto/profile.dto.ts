import { IsUUID, IsString, IsArray, IsOptional, IsEnum, IsObject, IsNumber } from 'class-validator';

// User Profile DTO
export class UserProfileDto {
  @IsUUID()
  id: string;

  @IsUUID()
  user_id: string;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// User Personalization DTO
export class UserPersonalizationDto {
  @IsUUID()
  user_id: string;

  @IsOptional()
  @IsString()
  current_position?: string;

  @IsOptional()
  @IsString()
  company_size?: string;

  @IsOptional()
  @IsString()
  primary_function?: string;

  @IsOptional()
  @IsArray()
  top_challenges?: string[];

  @IsOptional()
  @IsString()
  preferred_coaching_style?: string;

  @IsOptional()
  @IsEnum(['not_started', 'in_progress', 'completed'])
  onboarding_status?: 'not_started' | 'in_progress' | 'completed';

  @IsOptional()
  @IsObject()
  personality_scores?: Record<string, number>;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// Update Profile DTO
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;
}

// Update Personalization DTO
export class UpdatePersonalizationDto {
  @IsOptional()
  @IsString()
  current_position?: string;

  @IsOptional()
  @IsString()
  company_size?: string;

  @IsOptional()
  @IsString()
  primary_function?: string;

  @IsOptional()
  @IsArray()
  top_challenges?: string[];

  @IsOptional()
  @IsString()
  preferred_coaching_style?: string;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Complete Profile Response DTO
export class CompleteProfileDto {
  profile: UserProfileDto;
  personalization: UserPersonalizationDto;
  personality_scores?: Record<string, number>;
}

// Save Personality Scores DTO
export class SavePersonalityScoresDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsObject()
  scores: {
    assertiveness: number;
    strategic: number;
    adaptability: number;
    empathy: number;
    conscientiousness: number;
    integrity: number;
  };

  @IsObject()
  answers: Record<string, number>;

  @IsOptional()
  @IsObject()
  personalizationData?: {
    role?: string;
    companySize?: string;
    function?: string;
    challenges?: string[];
    personalityAnswers?: Record<string, string>;
  };
} 