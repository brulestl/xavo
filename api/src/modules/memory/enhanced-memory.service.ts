import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MemorySearchDto,
  MemorySearchResultDto,
  LongTermMemoryDto,
  ShortTermContextDto,
  CreateMemoryDto
} from './dto/enhanced-memory.dto';

@Injectable()
export class EnhancedMemoryService {
  private supabase: SupabaseClient;

  constructor() {
    // TODO: Move to config service
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }

  async searchMemories(
    userId: string, 
    searchDto: MemorySearchDto
  ): Promise<MemorySearchResultDto> {
    const result: MemorySearchResultDto = {
      memories: [],
      messages: [],
      total_results: 0,
      search_type: searchDto.type || 'both',
      query_used: searchDto.q || 'vector_search'
    };

    const threshold = searchDto.threshold || 0.7;
    const limit = searchDto.limit || 10;

    try {
      // If text query provided, generate embedding first
      let queryEmbedding = searchDto.embedding;
      if (searchDto.q && !queryEmbedding) {
        // TODO: Generate embedding from text query
        queryEmbedding = await this.generateEmbedding(searchDto.q);
      }

      // Search memories
      if (searchDto.type !== 'messages' && queryEmbedding) {
        const { data: memories, error: memoriesError } = await this.supabase
          .rpc('search_similar_memories', {
            p_user_id: userId,
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit
          });

        if (!memoriesError && memories) {
          result.memories = memories;
        }
      }

      // Search messages
      if (searchDto.type !== 'memories' && queryEmbedding) {
        const { data: messages, error: messagesError } = await this.supabase
          .rpc('search_similar_messages', {
            p_user_id: userId,
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit
          });

        if (!messagesError && messages) {
          result.messages = messages;
        }
      }

      // Fallback text search if no embedding
      if (!queryEmbedding && searchDto.q) {
        await this.performTextSearch(userId, searchDto.q, limit, result);
      }

      result.total_results = result.memories.length + result.messages.length;

    } catch (error) {
      console.error('Memory search failed:', error);
      throw new Error(`Memory search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  async getLongTermMemories(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ memories: LongTermMemoryDto[]; total: number }> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('long_term_memories')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch memories: ${error.message}`);
    }

    return {
      memories: data || [],
      total: count || 0
    };
  }

  async getShortTermContexts(
    userId: string, 
    sessionId?: string
  ): Promise<ShortTermContextDto[]> {
    let query = this.supabase
      .from('short_term_contexts')
      .select('*')
      .eq('user_id', userId);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch contexts: ${error.message}`);
    }

    return data || [];
  }

  async createMemory(
    userId: string, 
    createDto: CreateMemoryDto
  ): Promise<LongTermMemoryDto> {
    // Generate embedding for the memory content
    const embedding = await this.generateEmbedding(createDto.memory_content);

    const { data, error } = await this.supabase
      .from('long_term_memories')
      .insert({
        user_id: userId,
        memory_title: createDto.memory_title,
        memory_content: createDto.memory_content,
        memory_type: createDto.memory_type,
        topics: createDto.topics,
        scenarios: createDto.scenarios || [],
        confidence_score: createDto.confidence_score || 0.8,
        memory_embedding: embedding,
        metadata: createDto.metadata || {},
        source_session_ids: [],
        source_message_count: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create memory: ${error.message}`);
    }

    return data;
  }

  async updateMemory(
    userId: string, 
    memoryId: string, 
    updateData: Partial<CreateMemoryDto>
  ): Promise<LongTermMemoryDto> {
    // Generate new embedding if content changed
    let embedding;
    if (updateData.memory_content) {
      embedding = await this.generateEmbedding(updateData.memory_content);
    }

    const updatePayload = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    if (embedding) {
      updatePayload['memory_embedding'] = embedding;
    }

    const { data, error } = await this.supabase
      .from('long_term_memories')
      .update(updatePayload)
      .eq('id', memoryId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update memory: ${error.message}`);
    }

    return data;
  }

  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const { error } = await this.supabase
      .from('long_term_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete memory: ${error.message}`);
    }
  }

  async getMemoryById(userId: string, memoryId: string): Promise<LongTermMemoryDto | null> {
    const { data, error } = await this.supabase
      .from('long_term_memories')
      .select('*')
      .eq('id', memoryId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch memory: ${error.message}`);
    }

    return data;
  }

  private async generateEmbedding(content: string): Promise<number[] | null> {
    // TODO: Integrate with embeddings service
    try {
      // Placeholder - replace with actual embeddings service call
      console.log('TODO: Generate embedding for memory:', content.substring(0, 50) + '...');
      return null;
    } catch (error) {
      console.warn('Failed to generate embedding:', error);
      return null;
    }
  }

  private async performTextSearch(
    userId: string, 
    query: string, 
    limit: number, 
    result: MemorySearchResultDto
  ): Promise<void> {
    // Fallback text search using PostgreSQL full-text search
    const searchTerms = query.toLowerCase().split(' ').join(' | ');

    // Search memories by text
    const { data: memories } = await this.supabase
      .from('long_term_memories')
      .select('*')
      .eq('user_id', userId)
      .or(`memory_title.ilike.%${query}%,memory_content.ilike.%${query}%`)
      .limit(limit);

    if (memories) {
      result.memories = memories;
    }

    // Search messages by text
    const { data: messages } = await this.supabase
      .from('conversation_messages')
      .select('*')
      .eq('user_id', userId)
      .ilike('content', `%${query}%`)
      .limit(limit);

    if (messages) {
      result.messages = messages;
    }
  }
} 