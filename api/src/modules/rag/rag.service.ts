import { Injectable } from '@nestjs/common';
import { MemoryService } from '../memory/memory.service';
import { MemoryContext, MemoryStorageOptions } from '../memory/memory.types';
import { ChatRequestDto } from '../chat/dto/chat.dto';
import { AuthUser } from '../auth/auth.service';

export interface RAGContext {
  userQuery: string;
  memoryContext: MemoryContext;
  enhancedPrompt: string;
  contextSources: string[];
  relevanceScore: number;
}

export interface RAGOptions {
  useRecentContext?: boolean;
  useHistoricalContext?: boolean;
  useUserProfile?: boolean;
  maxContextTokens?: number;
  memoryOptions?: MemoryStorageOptions;
}

@Injectable()
export class RAGService {
  constructor(private memoryService: MemoryService) {}

  async enhanceRequestWithRAG(
    request: ChatRequestDto,
    user: AuthUser,
    options: RAGOptions = {},
  ): Promise<RAGContext> {
    const {
      useRecentContext = true,
      useHistoricalContext = true,
      useUserProfile = true,
      maxContextTokens = 2000,
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

      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(
        request,
        memoryContext,
        maxContextTokens,
      );

      // Track context sources for transparency
      const contextSources = this.getContextSources(memoryContext);

      // Calculate overall relevance score
      const relevanceScore = this.calculateContextRelevance(memoryContext);

      return {
        userQuery: request.message,
        memoryContext,
        enhancedPrompt,
        contextSources,
        relevanceScore,
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
        enhancedPrompt: this.buildBasicPrompt(request),
        contextSources: [],
        relevanceScore: 0,
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
} 