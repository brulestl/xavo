import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelRouterService } from './model-router.service';
import { RAGService } from '../rag/rag.service';
import { AuthUser } from '../auth/auth.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatService {
  constructor(
    private readonly modelRouter: ModelRouterService,
    private readonly ragService: RAGService,
    private readonly configService: ConfigService,
  ) {}

  async canUserMakeQuery(user: AuthUser): Promise<boolean> {
    // Power tier users have unlimited queries
    if (user.tier === 'power') {
      return true;
    }

    // For essential tier, we'll implement basic rate limiting
    // In production, this would check against a database
    // For now, we'll allow queries (frontend handles the limits)
    return true;
  }

  async processChat(
    request: ChatRequestDto,
    user: AuthUser,
  ): Promise<ChatResponseDto> {
    try {
      // Generate unique IDs
      const responseId = uuidv4();
      const sessionId = request.sessionId || uuidv4();

      // Use RAG to enhance the request with memory context
      const ragContext = await this.ragService.enhanceRequestWithRAG(request, user, {
        useRecentContext: true,
        useHistoricalContext: user.tier === 'power', // Only for Power tier
        useUserProfile: true,
        maxContextTokens: user.tier === 'power' ? 4000 : 2000,
      });

      // Create enhanced request with RAG context
      const enhancedRequest = {
        ...request,
        message: ragContext.enhancedPrompt,
        sessionId,
      };

      // Route to appropriate model based on user tier
      const modelResponse = await this.modelRouter.routeToModel(
        enhancedRequest,
        user.tier,
      );

      // Store the interaction for future RAG context
      await this.ragService.storeInteraction(
        request,
        modelResponse.message,
        user,
        sessionId,
      );

      // Construct response
      const response: ChatResponseDto = {
        id: responseId,
        message: modelResponse.message,
        timestamp: new Date().toISOString(),
        sessionId,
        model: modelResponse.modelUsed,
        usage: {
          tokensUsed: modelResponse.tokensUsed || 0,
          remainingQueries: user.tier === 'power' ? undefined : this.getRemainingQueries(user),
        },
      };

      // Enhanced logging with RAG context
      console.log(`Chat processed for user ${user.id} (${user.tier}):`, {
        requestId: responseId,
        actionType: request.actionType,
        modelUsed: modelResponse.modelUsed,
        tokensUsed: modelResponse.tokensUsed,
        ragContext: {
          contextSources: ragContext.contextSources,
          relevanceScore: ragContext.relevanceScore,
        },
      });

      return response;
    } catch (error) {
      console.error('Error processing chat:', error);
      throw error;
    }
  }

  private getRemainingQueries(user: AuthUser): number {
    // In production, this would query the database for actual usage
    // For now, return a mock value
    const maxQueries = 3; // Essential tier limit
    const usedQueries = user.dailyQueryCount || 0;
    return Math.max(0, maxQueries - usedQueries);
  }
} 