import { IsUUID, IsString, IsArray, IsOptional, IsEnum, IsObject, IsNumber } from 'class-validator';

// Memory Search Query DTO
export class MemorySearchDto {
  @IsOptional()
  @IsString()
  q?: string; // Text query

  @IsOptional()
  @IsArray()
  embedding?: number[]; // Vector embedding

  @IsOptional()
  @IsNumber()
  threshold?: number; // Similarity threshold (default 0.7)

  @IsOptional()
  @IsNumber()
  limit?: number; // Max results (default 10)

  @IsOptional()
  @IsEnum(['memories', 'messages', 'both'])
  type?: 'memories' | 'messages' | 'both'; // Search type
}

// Long-term Memory DTO
export class LongTermMemoryDto {
  @IsUUID()
  id: string;

  @IsUUID()
  user_id: string;

  @IsString()
  memory_title: string;

  @IsString()
  memory_content: string;

  @IsEnum(['insight', 'pattern', 'preference', 'goal'])
  memory_type: 'insight' | 'pattern' | 'preference' | 'goal';

  @IsArray()
  topics: string[];

  @IsOptional()
  @IsArray()
  scenarios?: string[];

  @IsOptional()
  @IsArray()
  source_session_ids?: string[];

  @IsOptional()
  @IsNumber()
  source_message_count?: number;

  @IsNumber()
  confidence_score: number;

  @IsOptional()
  @IsArray()
  memory_embedding?: number[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// Short-term Context DTO
export class ShortTermContextDto {
  @IsUUID()
  id: string;

  @IsUUID()
  session_id: string;

  @IsUUID()
  user_id: string;

  @IsString()
  summary_text: string;

  @IsArray()
  key_topics: string[];

  @IsOptional()
  @IsUUID()
  message_start_id?: string;

  @IsOptional()
  @IsUUID()
  message_end_id?: string;

  @IsNumber()
  message_count: number;

  @IsNumber()
  summary_version: number;

  @IsNumber()
  context_weight: number;

  @IsOptional()
  @IsArray()
  summary_embedding?: number[];

  created_at: string;
  last_accessed: string;
}

// Memory Search Result DTO
export class MemorySearchResultDto {
  memories: (LongTermMemoryDto & { similarity?: number })[];
  messages: (any & { similarity?: number })[];
  total_results: number;
  search_type: string;
  query_used: string;
}

// Create Memory DTO
export class CreateMemoryDto {
  @IsString()
  memory_title: string;

  @IsString()
  memory_content: string;

  @IsEnum(['insight', 'pattern', 'preference', 'goal'])
  memory_type: 'insight' | 'pattern' | 'preference' | 'goal';

  @IsArray()
  topics: string[];

  @IsOptional()
  @IsArray()
  scenarios?: string[];

  @IsOptional()
  @IsNumber()
  confidence_score?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
} 