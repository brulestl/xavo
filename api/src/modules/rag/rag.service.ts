import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { MemoryService } from '../memory/memory.service';
import { MemoryContext, MemoryStorageOptions } from '../memory/memory.types';
import { ChatRequestDto } from '../chat/dto/chat.dto';
import { AuthUser } from '../auth/auth.service';

export interface CoachCorpusMatch {
  id: string;
  chunk: string;
  tags: string[];
  source: string;
  speaker: string;
  metadata: any;
  similarity: number;
}

export interface RAGContext {
  userQuery: string;
  memoryContext: MemoryContext;
  coachContext: CoachCorpusMatch[];
  enhancedPrompt: string;
  contextSources: string[];
  relevanceScore: number;
  coachContextUsed: boolean;
}

export interface RAGOptions {
  useRecentContext?: boolean;
  useHistoricalContext?: boolean;
  useUserProfile?: boolean;
  useCoachCorpus?: boolean;
  maxContextTokens?: number;
  coachCorpusThreshold?: number;
  coachCorpusCount?: number;
  memoryOptions?: MemoryStorageOptions;
}

@Injectable()
export class RAGService {
  private supabase: SupabaseClient;
  private openai: OpenAI;

  constructor(private memoryService: MemoryService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async enhanceRequestWithRAG(
    request: ChatRequestDto,
    user: AuthUser,
    options: RAGOptions = {},
  ): Promise<RAGContext> {
    const {
      useRecentContext = true,
      useHistoricalContext = true,
      useUserProfile = true,
      useCoachCorpus = true,
      maxContextTokens = 4000,
      coachCorpusThreshold = 0.75,
      coachCorpusCount = 3,
      memoryOptions = {},
    } = options;

    try {
      // Get memory context for the user and session
      const memoryContext = await this.memoryService.getMemoryContext(
        user.id,
        request.sessionId || 'default',
        request.message,
        {
          ...memoryOptions,
          includeProfile: useUserProfile,
          maxRecentMessages: useRecentContext ? 10 : 0,
          maxRelevantHistory: useHistoricalContext ? 5 : 0,
        },
      );

      // Get coach corpus context (new functionality)
      let coachContext: CoachCorpusMatch[] = [];
      if (useCoachCorpus) {
        coachContext = await this.searchCoachCorpus(
          request.message,
          coachCorpusThreshold,
          coachCorpusCount
        );
      }

      // Build enhanced prompt with all context
      const enhancedPrompt = this.buildComprehensivePrompt(
        request,
        memoryContext,
        coachContext,
        maxContextTokens,
      );

      // Track context sources for transparency
      const contextSources = this.getAllContextSources(memoryContext, coachContext);

      // Calculate overall relevance score
      const relevanceScore = this.calculateOverallRelevance(memoryContext, coachContext);

      return {
        userQuery: request.message,
        memoryContext,
        coachContext,
        enhancedPrompt,
        contextSources,
        relevanceScore,
        coachContextUsed: coachContext.length > 0,
      };
    } catch (error) {
      console.error('Error enhancing request with RAG:', error);
      
      // Return basic context on error to prevent chat interruption
      return {
        userQuery: request.message,
        memoryContext: {
          recentMessages: [],
          relevantHistory: [],
        },
        coachContext: [],
        enhancedPrompt: this.buildBasicPrompt(request),
        contextSources: [],
        relevanceScore: 0,
        coachContextUsed: false,
      };
    }
  }

  async storeInteraction(
    request: ChatRequestDto,
    response: string,
    user: AuthUser,
    sessionId: string,
  ): Promise<void> {
    try {
      // Store user message
      await this.memoryService.storeMessage({
        sessionId,
        userId: user.id,
        role: 'user',
        content: request.message,
        actionType: request.actionType,
        metadata: {
          timestamp: new Date().toISOString(),
          userTier: user.tier,
        },
      });

      // Store assistant response
      await this.memoryService.storeMessage({
        sessionId,
        userId: user.id,
        role: 'assistant',
        content: response,
        actionType: request.actionType,
        metadata: {
          timestamp: new Date().toISOString(),
          responseGenerated: true,
        },
      });
    } catch (error) {
      console.error('Error storing interaction:', error);
      // Don't throw error to prevent chat interruption
    }
  }

  private buildEnhancedPrompt(
    request: ChatRequestDto,
    memoryContext: MemoryContext,
    maxTokens: number,
  ): string {
    let prompt = '';
    let tokenCount = 0;

    // Add system context for Corporate Influence Coach
    const systemContext = this.getSystemContext(request.actionType);
    prompt += systemContext;
    tokenCount += this.estimateTokens(systemContext);

    // Add user profile context if available
    if (memoryContext.userProfile && tokenCount < maxTokens * 0.3) {
      const profileContext = this.buildProfileContext(memoryContext.userProfile);
      prompt += profileContext;
      tokenCount += this.estimateTokens(profileContext);
    }

    // Add recent conversation context
    if (memoryContext.recentMessages.length > 0 && tokenCount < maxTokens * 0.6) {
      const recentContext = this.buildRecentContext(memoryContext.recentMessages);
      if (tokenCount + this.estimateTokens(recentContext) < maxTokens * 0.6) {
        prompt += recentContext;
        tokenCount += this.estimateTokens(recentContext);
      }
    }

    // Add relevant historical context
    if (memoryContext.relevantHistory.length > 0 && tokenCount < maxTokens * 0.8) {
      const historyContext = this.buildHistoryContext(memoryContext.relevantHistory);
      if (tokenCount + this.estimateTokens(historyContext) < maxTokens * 0.8) {
        prompt += historyContext;
        tokenCount += this.estimateTokens(historyContext);
      }
    }

    // Add current user query
    prompt += `\n\nCurrent Question: ${request.message}\n\nPlease provide a comprehensive response that takes into account the conversation history and user context above.`;

    return prompt;
  }

  private buildBasicPrompt(request: ChatRequestDto): string {
    const systemContext = this.getSystemContext(request.actionType);
    return `${systemContext}\n\nUser Question: ${request.message}`;
  }

  private getSystemContext(actionType?: string): string {
    const baseContext = `You are a Corporate Influence Coach, an AI assistant specialized in helping professionals navigate workplace dynamics, office politics, and corporate communication. You provide strategic advice on stakeholder management, influence building, and professional relationship development.`;

    const actionSpecificContext = {
      evaluate_scenario: ` Focus on analyzing the political landscape, power dynamics, and potential risks/opportunities in the situation.`,
      plan_strategy: ` Provide step-by-step strategic recommendations with specific actions and timing considerations.`,
      analyze_stakeholders: ` Help map stakeholder influence, interests, and relationship dynamics with actionable insights.`,
      summarize_policy: ` Break down complex policies into key implications and strategic considerations for the user.`,
      brainstorm_insights: ` Generate creative perspectives and alternative approaches to workplace challenges.`,
      draft_email: ` Focus on tone, messaging strategy, and political sensitivity in professional communications.`,
    };

    return baseContext + (actionSpecificContext[actionType] || '');
  }

  private buildProfileContext(profile: any): string {
    let context = '\n\nUser Context:';
    
    if (profile.workContext) {
      context += `\n- Role: ${profile.workContext.role || 'Professional'}`;
      context += `\n- Industry: ${profile.workContext.industry || 'Not specified'}`;
      context += `\n- Seniority: ${profile.workContext.seniority || 'Not specified'}`;
    }

    if (profile.communicationStyle) {
      context += `\n- Communication Style: ${profile.communicationStyle.formality || 'balanced'}, ${profile.communicationStyle.directness || 'balanced'}`;
    }

    if (profile.frequentTopics && profile.frequentTopics.length > 0) {
      context += `\n- Common Topics: ${profile.frequentTopics.slice(0, 3).join(', ')}`;
    }

    return context + '\n';
  }

  private buildRecentContext(messages: any[]): string {
    if (messages.length === 0) return '';

    let context = '\n\nRecent Conversation:\n';
    messages.slice(-5).forEach(msg => {
      context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });

    return context;
  }

  private buildHistoryContext(messages: any[]): string {
    if (messages.length === 0) return '';

    let context = '\n\nRelevant Past Discussions:\n';
    messages.forEach(msg => {
      context += `- ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}\n`;
    });

    return context;
  }

  private getContextSources(memoryContext: MemoryContext): string[] {
    const sources: string[] = [];

    if (memoryContext.recentMessages.length > 0) {
      sources.push(`${memoryContext.recentMessages.length} recent messages`);
    }

    if (memoryContext.relevantHistory.length > 0) {
      sources.push(`${memoryContext.relevantHistory.length} relevant past discussions`);
    }

    if (memoryContext.userProfile) {
      sources.push('user profile');
    }

    if (memoryContext.sessionSummary) {
      sources.push('session summary');
    }

    return sources;
  }

  private calculateContextRelevance(memoryContext: MemoryContext): number {
    let totalRelevance = 0;
    let factorCount = 0;

    // Recent messages relevance
    if (memoryContext.recentMessages.length > 0) {
      totalRelevance += 0.8; // Recent context is highly relevant
      factorCount++;
    }

    // Historical context relevance
    if (memoryContext.relevantHistory.length > 0) {
      const avgRelevance = memoryContext.relevantHistory.length > 0 ? 0.6 : 0;
      totalRelevance += avgRelevance;
      factorCount++;
    }

    // User profile relevance
    if (memoryContext.userProfile) {
      totalRelevance += 0.4;
      factorCount++;
    }

    return factorCount > 0 ? totalRelevance / factorCount : 0;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Search coach corpus for relevant content
   */
  private async searchCoachCorpus(
    query: string,
    threshold: number = 0.75,
    matchCount: number = 3
  ): Promise<CoachCorpusMatch[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Search using the database function
      const { data, error } = await this.supabase.rpc('match_coach_corpus', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: matchCount,
      });

      if (error) {
        console.error('Error searching coach corpus:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchCoachCorpus:', error);
      return [];
    }
  }

  /**
   * Generate embedding for query text
   */
  private async generateQueryEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.trim().substring(0, 8000),
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating query embedding:', error);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  /**
   * Build comprehensive prompt with all available context
   */
  private buildComprehensivePrompt(
    request: ChatRequestDto,
    memoryContext: MemoryContext,
    coachContext: CoachCorpusMatch[],
    maxTokens: number,
  ): string {
    let prompt = '';
    let tokenCount = 0;

    // Add system context
    const systemContext = this.getSystemContext(request.actionType);
    prompt += systemContext;
    tokenCount += this.estimateTokens(systemContext);

    // Add coach corpus context (highest priority)
    if (coachContext.length > 0 && tokenCount < maxTokens * 0.4) {
      const coachContextStr = this.buildCoachContext(coachContext);
      if (tokenCount + this.estimateTokens(coachContextStr) < maxTokens * 0.4) {
        prompt += coachContextStr;
        tokenCount += this.estimateTokens(coachContextStr);
      }
    }

    // Add user profile context
    if (memoryContext.userProfile && tokenCount < maxTokens * 0.6) {
      const profileContext = this.buildProfileContext(memoryContext.userProfile);
      if (tokenCount + this.estimateTokens(profileContext) < maxTokens * 0.6) {
        prompt += profileContext;
        tokenCount += this.estimateTokens(profileContext);
      }
    }

    // Add recent conversation context
    if (memoryContext.recentMessages.length > 0 && tokenCount < maxTokens * 0.8) {
      const recentContext = this.buildRecentContext(memoryContext.recentMessages);
      if (tokenCount + this.estimateTokens(recentContext) < maxTokens * 0.8) {
        prompt += recentContext;
        tokenCount += this.estimateTokens(recentContext);
      }
    }

    // Add relevant historical context (lowest priority)
    if (memoryContext.relevantHistory.length > 0 && tokenCount < maxTokens * 0.9) {
      const historyContext = this.buildHistoryContext(memoryContext.relevantHistory);
      if (tokenCount + this.estimateTokens(historyContext) < maxTokens * 0.9) {
        prompt += historyContext;
        tokenCount += this.estimateTokens(historyContext);
      }
    }

    // Add current user query
    prompt += `\n\nCurrent Question: ${request.message}\n\nPlease provide a comprehensive response that incorporates the coach expertise above, takes into account the conversation history and user context, and follows the system guidelines.`;

    return prompt;
  }

  /**
   * Build coach context from corpus matches
   */
  private buildCoachContext(coachMatches: CoachCorpusMatch[]): string {
    if (coachMatches.length === 0) return '';

    let context = '\n\nRelevant Coach Expertise:\n';
    
    coachMatches.forEach((match, index) => {
      context += `\n--- Expert Insight ${index + 1} (${(match.similarity * 100).toFixed(1)}% relevant) ---\n`;
      context += `Source: ${match.source}\n`;
      if (match.tags.length > 0) {
        context += `Topics: ${match.tags.join(', ')}\n`;
      }
      context += `Content: ${match.chunk}\n`;
    });

    context += '\n--- End Expert Insights ---\n';
    return context;
  }

  /**
   * Get all context sources including coach corpus
   */
  private getAllContextSources(memoryContext: MemoryContext, coachContext: CoachCorpusMatch[]): string[] {
    const sources: string[] = [];

    if (coachContext.length > 0) {
      const uniqueSources = [...new Set(coachContext.map(c => c.source))];
      sources.push(`coach expertise from ${uniqueSources.length} source(s)`);
    }

    if (memoryContext.recentMessages.length > 0) {
      sources.push(`${memoryContext.recentMessages.length} recent messages`);
    }

    if (memoryContext.relevantHistory.length > 0) {
      sources.push(`${memoryContext.relevantHistory.length} relevant past discussions`);
    }

    if (memoryContext.userProfile) {
      sources.push('user profile');
    }

    return sources;
  }

  /**
   * Calculate overall relevance including coach corpus
   */
  private calculateOverallRelevance(memoryContext: MemoryContext, coachContext: CoachCorpusMatch[]): number {
    let totalRelevance = 0;
    let factorCount = 0;

    // Coach corpus relevance (weighted highest)
    if (coachContext.length > 0) {
      const avgCoachRelevance = coachContext.reduce((sum, match) => sum + match.similarity, 0) / coachContext.length;
      totalRelevance += avgCoachRelevance * 2; // Double weight for coach context
      factorCount += 2;
    }

    // Recent messages relevance
    if (memoryContext.recentMessages.length > 0) {
      totalRelevance += 0.8;
      factorCount++;
    }

    // Historical context relevance
    if (memoryContext.relevantHistory.length > 0) {
      totalRelevance += 0.6;
      factorCount++;
    }

    // User profile relevance
    if (memoryContext.userProfile) {
      totalRelevance += 0.4;
      factorCount++;
    }

    return factorCount > 0 ? totalRelevance / factorCount : 0;
  }

  /**
   * Get coach corpus statistics
   */
  async getCoachCorpusStats(): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc('get_coach_corpus_stats');
      
      if (error) {
        console.error('Error getting corpus stats:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error in getCoachCorpusStats:', error);
      return null;
    }
  }
} 