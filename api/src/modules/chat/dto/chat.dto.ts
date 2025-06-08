import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ChatActionType {
  EVALUATE_SCENARIO = 'evaluate_scenario',
  PLAN_STRATEGY = 'plan_strategy',
  ANALYZE_STAKEHOLDERS = 'analyze_stakeholders',
  SUMMARIZE_POLICY = 'summarize_policy',
  BRAINSTORM_INSIGHTS = 'brainstorm_insights',
  DRAFT_EMAIL = 'draft_email',
  GENERAL_CHAT = 'general_chat',
}

export class ChatRequestDto {
  @ApiProperty({
    description: 'The user message or query',
    example: 'How should I approach my manager about a promotion?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Type of action being requested',
    enum: ChatActionType,
    example: ChatActionType.PLAN_STRATEGY,
  })
  @IsOptional()
  @IsEnum(ChatActionType)
  actionType?: ChatActionType;

  @ApiPropertyOptional({
    description: 'Previous conversation context',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  context?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Session ID for conversation continuity',
    example: 'session_123456',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'AI response message',
    example: 'Here are some strategies for approaching your manager about a promotion...',
  })
  message: string;

  @ApiProperty({
    description: 'Unique response ID',
    example: 'resp_123456',
  })
  id: string;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Session ID',
    example: 'session_123456',
  })
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Model used for response',
    example: 'essential-coach',
  })
  model?: string;

  @ApiPropertyOptional({
    description: 'Usage statistics',
  })
  usage?: {
    tokensUsed: number;
    remainingQueries?: number;
  };
} 