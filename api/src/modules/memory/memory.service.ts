import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  ConversationMessage,
  ConversationSession,
  MemoryContext,
  UserProfile,
  SimilaritySearchRequest,
  SimilaritySearchResult,
  MemoryStorageOptions,
} from './memory.types';
import { IEmbeddingsService } from '../embeddings/embeddings.interface';
import { EMBEDDINGS_SERVICE } from '../embeddings/embeddings.module';

@Injectable()
export class MemoryService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    @Inject(EMBEDDINGS_SERVICE) private embeddingsService: IEmbeddingsService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || 
                       this.configService.get<string>('SUPABASE_ANON_KEY');

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async storeMessage(message: Omit<ConversationMessage, 'id' | 'timestamp' | 'embedding'>): Promise<ConversationMessage> {
    try {
      // Generate embedding for the message content
      const embeddingResponse = await this.embeddingsService.getEmbedding({
        text: message.content,
        userId: message.userId,
      });

      const messageWithId: ConversationMessage = {
        ...message,
        id: uuidv4(),
        timestamp: new Date(),
        embedding: embeddingResponse.embedding.values,
        tokenCount: embeddingResponse.tokens,
      };

      const { data, error } = await this.supabase
        .from('conversation_messages')
        .insert([{
          id: messageWithId.id,
          session_id: messageWithId.sessionId,
          user_id: messageWithId.userId,
          role: messageWithId.role,
          content: messageWithId.content,
          action_type: messageWithId.actionType,
          metadata: messageWithId.metadata,
          embedding: messageWithId.embedding,
          timestamp: messageWithId.timestamp.toISOString(),
          token_count: messageWithId.tokenCount,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error storing message:', error);
        throw new Error(`Failed to store message: ${error.message}`);
      }

      // Update session last message time
      await this.updateSessionActivity(message.sessionId, message.userId);

      return messageWithId;
    } catch (error) {
      console.error('Memory service error storing message:', error);
      throw error;
    }
  }

  async getMemoryContext(
    userId: string,
    sessionId: string,
    currentQuery?: string,
    options: MemoryStorageOptions = {},
  ): Promise<MemoryContext> {
    const {
      maxRecentMessages = 10,
      maxRelevantHistory = 5,
      similarityThreshold = 0.7,
      includeProfile = true,
    } = options;

    try {
      // Get recent messages from current session
      const recentMessages = await this.getRecentMessages(sessionId, maxRecentMessages);

      // Get relevant historical context if query provided
      let relevantHistory: ConversationMessage[] = [];
      if (currentQuery) {
        const similarityResults = await this.searchSimilarMessages({
          query: currentQuery,
          userId,
          limit: maxRelevantHistory,
          threshold: similarityThreshold,
          excludeCurrentSession: true,
        });
        relevantHistory = similarityResults.map(result => result.message);
      }

      // Get user profile if requested
      let userProfile: UserProfile | undefined;
      if (includeProfile) {
        userProfile = await this.getUserProfile(userId);
      }

      // Get session summary if available
      const sessionSummary = await this.getSessionSummary(sessionId);

      return {
        recentMessages,
        relevantHistory,
        userProfile,
        sessionSummary,
      };
    } catch (error) {
      console.error('Error getting memory context:', error);
      throw new Error(`Failed to get memory context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchSimilarMessages(request: SimilaritySearchRequest): Promise<SimilaritySearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingsService.getEmbedding({
        text: request.query,
        userId: request.userId,
      });

      // Build the query
      let query = this.supabase
        .from('conversation_messages')
        .select('*')
        .eq('user_id', request.userId);

      if (request.excludeCurrentSession && request.sessionId) {
        query = query.neq('session_id', request.sessionId);
      }

      // Use RPC function for vector similarity search
      const { data, error } = await this.supabase.rpc('search_similar_messages', {
        query_embedding: queryEmbedding.embedding.values,
        user_id: request.userId,
        similarity_threshold: request.threshold || 0.7,
        match_count: request.limit || 5,
        exclude_session_id: request.excludeCurrentSession ? request.sessionId : null,
      });

      if (error) {
        console.error('Error searching similar messages:', error);
        throw new Error(`Similarity search failed: ${error.message}`);
      }

      return (data || []).map((row: any) => ({
        message: this.mapRowToMessage(row),
        similarity: row.similarity || 0,
        relevanceScore: this.calculateRelevanceScore(row.similarity || 0, row.timestamp),
      }));
    } catch (error) {
      console.error('Error in similarity search:', error);
      return []; // Return empty array on error to prevent chat interruption
    }
  }

  async createSession(userId: string, title?: string): Promise<ConversationSession> {
    const session: ConversationSession = {
      id: uuidv4(),
      userId,
      title: title || 'New Conversation',
      lastMessageAt: new Date(),
      createdAt: new Date(),
      messageCount: 0,
      isActive: true,
    };

    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .insert([{
        id: session.id,
        user_id: session.userId,
        title: session.title,
        last_message_at: session.lastMessageAt.toISOString(),
        created_at: session.createdAt.toISOString(),
        message_count: session.messageCount,
        is_active: session.isActive,
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return session;
  }

  private async getRecentMessages(sessionId: string, limit: number): Promise<ConversationMessage[]> {
    const { data, error } = await this.supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting recent messages:', error);
      return [];
    }

    return (data || []).map(this.mapRowToMessage).reverse(); // Reverse to get chronological order
  }

  private async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return undefined;
    }

    return {
      userId: data.user_id,
      preferences: data.preferences,
      workContext: data.work_context,
      communicationStyle: data.communication_style,
      frequentTopics: data.frequent_topics,
      lastUpdated: new Date(data.last_updated),
    };
  }

  private async getSessionSummary(sessionId: string): Promise<string | undefined> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .select('summary')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return undefined;
    }

    return data.summary;
  }

  private async updateSessionActivity(sessionId: string, userId: string): Promise<void> {
    await this.supabase
      .from('conversation_sessions')
      .update({ 
        last_message_at: new Date().toISOString(),
        message_count: this.supabase.rpc('increment_message_count', { session_id: sessionId }),
      })
      .eq('id', sessionId)
      .eq('user_id', userId);
  }

  private mapRowToMessage(row: any): ConversationMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      role: row.role,
      content: row.content,
      actionType: row.action_type,
      metadata: row.metadata,
      embedding: row.embedding,
      timestamp: new Date(row.timestamp),
      tokenCount: row.token_count,
    };
  }

  private calculateRelevanceScore(similarity: number, timestamp: string): number {
    // Calculate time decay (more recent = higher score)
    const messageAge = Date.now() - new Date(timestamp).getTime();
    const daysSinceMessage = messageAge / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-daysSinceMessage / 30); // 30-day half-life

    // Combine similarity and recency
    return similarity * 0.8 + timeDecay * 0.2;
  }
} 