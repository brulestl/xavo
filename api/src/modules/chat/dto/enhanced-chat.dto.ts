import { IsUUID, IsString, IsArray, IsOptional, IsEnum, IsObject, IsNumber } from 'class-validator';

// Conversation Session DTO
export class ConversationSessionDto {
  @IsUUID()
  id: string;

  @IsUUID()
  user_id: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  is_active: boolean;
  message_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

// Chat Session DTO (simplified for API responses)
export class ChatSessionDto {
  @IsUUID()
  id: string;

  @IsString()
  title: string;

  @IsNumber()
  message_count: number;

  created_at: string;
  last_message_at?: string;
}

// Conversation Message DTO
export class ConversationMessageDto {
  @IsUUID()
  id: string;

  @IsUUID()
  session_id: string;

  @IsUUID()
  user_id: string;

  @IsEnum(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  content_embedding?: number[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  message_timestamp: string;
  created_at: string;
}

// Message DTO (simplified for API responses)
export class MessageDto {
  @IsUUID()
  id: string;

  @IsUUID()
  session_id: string;

  @IsEnum(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;

  created_at: string;

  @IsOptional()
  @IsArray()
  function_calls?: any[];
}

// Send Message DTO
export class SendMessageDto {
  @IsString()
  content: string;

  @IsUUID()
  session_id: string;
}

// Create Message DTO
export class CreateMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  session_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Create Session DTO
export class CreateSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// Chat Response DTO
export class ChatResponseDto {
  message: ConversationMessageDto;
  session: ConversationSessionDto;
  context_used?: {
    memories: any[];
    similar_messages: any[];
  };
}

// Session List DTO
export class SessionListDto {
  sessions: ConversationSessionDto[];
  total: number;
  page: number;
  limit: number;
}

// Session Detail DTO
export class SessionDetailDto {
  session: ConversationSessionDto;
  messages: ConversationMessageDto[];
  summaries?: any[];
} 