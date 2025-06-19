import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Response,
  HttpException,
  HttpStatus,
  Headers,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

import { ChatService } from './chat.service';
import { EnhancedChatService } from './enhanced-chat.service';
import { RAGService } from '../rag/rag.service';
import { ContextInjectionService } from './context-injection.service';
import { SummaryGenerationService } from './summary-generation.service';
// import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { 
  SendMessageDto, 
  CreateSessionDto, 
  SessionListDto, 
  SessionDetailDto,
  ChatSessionDto,
  MessageDto 
} from './dto/enhanced-chat.dto';
import { assertPromptCredit } from '../../utils/credits';
import { streamCoachAssistant, buildChatMessages } from '../../utils/openai';
import { processResponse } from '../../utils/response-processor';
import { Tier } from '../../config/plans';

interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@ApiTags('chat')
@Controller('chat')
// @UseGuards(AuthGuard)  // Temporarily disabled for testing
// @ApiBearerAuth()       // Temporarily disabled for testing
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly enhancedChatService: EnhancedChatService,
    private readonly ragService: RAGService,
    private readonly contextInjectionService: ContextInjectionService,
    private readonly summaryGenerationService: SummaryGenerationService,
  ) {}

  @Post('stream')
  @ApiOperation({ 
    summary: 'Send a message and stream AI response',
    description: 'Sends a message to the AI coach and streams the response in real-time using SSE.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'AI response streamed successfully'
  })
  @ApiBody({ type: ChatRequestDto })
  async streamChat(
    @Body() chatRequest: ChatRequestDto,
    @Request() req: AuthenticatedRequest,
    @Response() res: any,
    @Headers('x-tier') tierHeader?: string,
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    try {
      // Temporarily use a mock user for testing
      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const tier = tierHeader as Tier || 'trial';
      
      console.log(`Processing streaming chat request for user ${userId}`);
      
      const { message, sessionId } = chatRequest;
      
      // Create session if not provided
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        try {
          const newSession = await this.enhancedChatService.createChatSession(
            userId,
            this.generateSessionTitle(message)
          );
          currentSessionId = newSession.id;
          
          // Send session creation event
          res.write(`data: ${JSON.stringify({
            type: 'session_created',
            sessionId: currentSessionId
          })}\n\n`);
          
        } catch (error) {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: 'Failed to create session'
          })}\n\n`);
          res.end();
          return;
        }
      }
      
      // Store user message
      try {
        await this.storeMessage(userId, currentSessionId, message, 'user');
        
        // Send user message confirmation
        res.write(`data: ${JSON.stringify({
          type: 'user_message_stored',
          sessionId: currentSessionId
        })}\n\n`);
        
      } catch (error) {
        console.error('Failed to store user message:', error);
        // Continue anyway for now
      }
      
      // 🔥 FETCH CONVERSATION CONTEXT (short-term summary + message history)
      const conversationContext = await this.contextInjectionService.getSessionContext(
        currentSessionId, 
        userId, 
        tier === 'shark' ? 15 : 10 // More context for premium users
      );
      
      console.log(`📊 Context retrieved: ${conversationContext.contextTokens} tokens, ${conversationContext.messageHistory.length} messages`);
      
      // Update context access timestamp
      if (conversationContext.shortTermSummary) {
        await this.contextInjectionService.updateContextAccess(currentSessionId, userId);
      }

      // Get user profile for personalization
      let userPersonalization = {};
      let personalityScores = {};
      try {
        // TODO: Get actual user personalization from profile service
        // For now, use mock data based on tier
        userPersonalization = {
          current_position: 'Manager',
          industry: 'Technology',
          seniority_level: tier === 'trial' ? 'mid-management' : 'senior',
          top_challenges: ['team leadership', 'strategic planning'],
          communication_style: { formality: 'balanced', directness: 'balanced' }
        };
      } catch (error) {
        console.warn('Could not load user personalization:', error);
      }

      // Get enhanced context using RAG service
      const ragContext = await this.ragService.enhanceRequestWithRAG(
        { message, sessionId: currentSessionId, actionType: 'general' } as any,
        { id: userId, tier } as any,
        {
          useCoachCorpus: true,
          maxContextTokens: tier === 'shark' ? 8000 : 4000,
          coachCorpusThreshold: 0.75,
          coachCorpusCount: 3
        }
      );

      // 🔥 Build OpenAI messages with FULL CONTEXT INJECTION
      const formattedContext = this.contextInjectionService.formatContextForOpenAI(conversationContext);
      const openaiMessages = buildChatMessages(message, {
        context: ragContext.enhancedPrompt,
        tier: tier as any,
        userPersonalization: userPersonalization as any,
        personalityScores: personalityScores as any,
        conversationContext: formattedContext // 🔥 INJECT CONVERSATION CONTEXT
      });
      
      // Stream the OpenAI response
      const completion = await streamCoachAssistant(openaiMessages);
      let fullResponse = '';
      let rawResponseChunks = [];
      
      // Send start streaming event
      res.write(`data: ${JSON.stringify({
        type: 'stream_start'
      })}\n\n`);
      
      for await (const chunk of completion) {
        // Store raw chunk for later persistence
        rawResponseChunks.push(chunk);
        
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          
          // Send token to client
          res.write(`data: ${JSON.stringify({
            type: 'token',
            content: content
          })}\n\n`);
        }
      }
      
      // 🔥 APPLY ENHANCED FORMATTING AND CONDITIONAL "Power Move:" PROCESSING
      const processedResponse = this.processResponseFormatting(fullResponse);
      console.log(`🎯 Response processed: ${processedResponse !== fullResponse ? 'Formatted and processed' : 'No changes'}`);

      // Store the complete assistant message with raw response
      try {
        const rawResponseData = {
          chunks: rawResponseChunks,
          fullText: fullResponse,
          processedText: processedResponse,
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString()
        };

        const assistantMessage = await this.storeMessage(
          userId, 
          currentSessionId, 
          processedResponse, // Store the processed response
          'assistant',
          rawResponseData // Store the raw response data
        );
        
        // Update session activity
        await this.updateSessionActivity(currentSessionId);
        
        // 🔥 TRIGGER BACKGROUND SUMMARY GENERATION
        this.summaryGenerationService.triggerSummaryGeneration(currentSessionId, userId);
        
        // Send completion event
        res.write(`data: ${JSON.stringify({
          type: 'stream_complete',
          messageId: assistantMessage.id,
          sessionId: currentSessionId,
          fullMessage: processedResponse // Send the processed response
        })}\n\n`);
        
      } catch (error) {
        console.error('Failed to store assistant message:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Failed to store response'
        })}\n\n`);
      }
      
      res.end();
      
    } catch (error) {
      console.error('Streaming chat error:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })}\n\n`);
      res.end();
    }
  }

  @Post()
  @ApiOperation({ 
    summary: 'Send a message and get AI response (non-streaming)',
    description: 'Sends a message to the AI coach and returns a complete response. Creates a new session if sessionId is not provided.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'AI response generated successfully',
    type: ChatResponseDto 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded' 
  })
  @ApiBody({ type: ChatRequestDto })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Request() req: AuthenticatedRequest,
    @Headers('x-tier') tierHeader?: string,
  ): Promise<ChatResponseDto> {
    try {
      // Temporarily use a mock user for testing
      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Valid UUID format
      const tier = tierHeader as Tier || 'trial';
      
      console.log(`Processing chat request for user ${userId} with tier ${tier}`);
      
      // TEMPORARILY DISABLED: Assert prompt credit (this will consume daily usage)
      // await assertPromptCredit(userId, tier);
      console.log('⚠️ Daily prompt cap temporarily disabled for testing');
      
      const { message, sessionId } = chatRequest;
      
      console.log(`💬 Processing message: "${message}"`);
      
      // Create session if not provided
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        try {
          const newSession = await this.enhancedChatService.createChatSession(
            userId,
            this.generateSessionTitle(message)
          );
          currentSessionId = newSession.id;
          console.log(`✅ Created new session: ${currentSessionId}`);
        } catch (error) {
          console.error('Failed to create session, using mock ID:', error);
          currentSessionId = `session_${Date.now()}`;
        }
      }
      
      // Store user message first
      let userMessageId: string;
      try {
        const userMessage = await this.storeMessage(
          userId, 
          currentSessionId, 
          chatRequest.message, 
          'user'
        );
        userMessageId = userMessage.id;
        console.log(`✅ Stored user message: ${userMessageId}`);
      } catch (error) {
        console.error('Failed to store user message:', error);
        userMessageId = `user_${Date.now()}`;
      }

      // 🔥 FETCH CONVERSATION CONTEXT (short-term summary + message history)
      const conversationContext = await this.contextInjectionService.getSessionContext(
        currentSessionId, 
        userId, 
        tier === 'shark' ? 15 : 10 // More context for premium users
      );
      
      console.log(`📊 Context retrieved: ${conversationContext.contextTokens} tokens, ${conversationContext.messageHistory.length} messages`);
      
      // Update context access timestamp
      if (conversationContext.shortTermSummary) {
        await this.contextInjectionService.updateContextAccess(currentSessionId, userId);
      }

      // Get user profile for personalization (duplicate this logic from streaming endpoint)
      let userPersonalization = {};
      let personalityScores = {};
      try {
        userPersonalization = {
          current_position: 'Manager',
          industry: 'Technology',
          seniority_level: tier === 'trial' ? 'mid-management' : 'senior',
          top_challenges: ['team leadership', 'strategic planning'],
          communication_style: { formality: 'balanced', directness: 'balanced' }
        };
      } catch (error) {
        console.warn('Could not load user personalization:', error);
      }

      // Get enhanced context using RAG service
      const ragContext = await this.ragService.enhanceRequestWithRAG(
        { message, sessionId: currentSessionId, actionType: 'general' } as any,
        { id: userId, tier } as any,
        {
          useCoachCorpus: true,
          maxContextTokens: tier === 'shark' ? 8000 : 4000,
          coachCorpusThreshold: 0.75,
          coachCorpusCount: 3
        }
      );

      // 🔥 Build OpenAI messages with FULL CONTEXT INJECTION
      const formattedContext = this.contextInjectionService.formatContextForOpenAI(conversationContext);
      const contextMessages = buildChatMessages(message, {
        context: ragContext.enhancedPrompt,
        tier: tier as any,
        userPersonalization: userPersonalization as any,
        personalityScores: personalityScores as any,
        conversationContext: formattedContext // 🔥 INJECT CONVERSATION CONTEXT
      });
      
      // Get streaming response and collect it
      console.log('🤖 Calling OpenAI...');
      const completion = await streamCoachAssistant(contextMessages);
      
      // Collect the full response and raw chunks
      let fullResponse = '';
      let rawResponseChunks = [];
      for await (const chunk of completion) {
        rawResponseChunks.push(chunk);
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
      }
      
      console.log(`✅ Generated response: "${fullResponse.substring(0, 100)}..."`);

      // 🔥 APPLY ENHANCED FORMATTING AND CONDITIONAL "Power Move:" PROCESSING
      const processedResponse = this.processResponseFormatting(fullResponse);
      console.log(`🎯 Response processed: ${processedResponse !== fullResponse ? 'Formatted' : 'No changes'}`);

      // Store assistant message with complete raw response data
      let assistantMessageId: string;
      try {
        const rawResponseData = {
          chunks: rawResponseChunks,
          fullText: fullResponse,
          processedText: processedResponse,
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString(),
          user_message_id: userMessageId,
          context_messages_count: contextMessages.length,
          context_tokens: conversationContext.contextTokens
        };

        const assistantMessage = await this.storeMessage(
          userId, 
          currentSessionId, 
          processedResponse, // Store the processed response as content
          'assistant',
          rawResponseData // Store complete raw response data
        );
        assistantMessageId = assistantMessage.id;
        console.log(`✅ Stored assistant message: ${assistantMessageId} with raw response data`);
        
        // Update session activity
        await this.updateSessionActivity(currentSessionId);
        
        // 🔥 TRIGGER BACKGROUND SUMMARY GENERATION
        this.summaryGenerationService.triggerSummaryGeneration(currentSessionId, userId);
      } catch (error) {
        console.error('Failed to store assistant message:', error);
        assistantMessageId = `assistant_${Date.now()}`;
      }
      
      return {
        id: assistantMessageId,
        message: processedResponse, // Return the processed response
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId,
        model: 'gpt-4o-mini',
        usage: {
          tokensUsed: Math.ceil(processedResponse.length / 4), // Rough estimation
          remainingQueries: 999, // Unlimited for testing
        }
      };
      
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      console.error('Chat processing error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      throw new HttpException(
        `An error occurred while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async storeMessage(
    userId: string,
    sessionId: string,
    content: string,
    role: 'user' | 'assistant',
    rawResponseData?: { chunks: any[]; fullText: string; processedText: string; model: string; timestamp: string }
  ): Promise<{ id: string; created_at: string }> {
    return await this.enhancedChatService.storeMessage(userId, sessionId, content, role, rawResponseData);
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    return await this.enhancedChatService.updateSessionActivity(sessionId);
  }

  private buildContextFromMessages(messages: MessageDto[]): string {
    if (messages.length === 0) return '';
    
    return messages
      .slice(-6) // Last 6 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
  }

  @Get('sessions')
  @ApiOperation({ 
    summary: 'Get user chat sessions',
    description: 'Retrieves all chat sessions for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Chat sessions retrieved successfully',
    type: [ChatSessionDto]
  })
  async getSessions(
    @Request() req: AuthenticatedRequest,
  ): Promise<{ sessions: ChatSessionDto[] }> {
    try {
      const userId = req.user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      console.log(`Getting sessions for user: ${userId}`);
      
      const sessions = await this.enhancedChatService.getChatSessions(userId);
      return { sessions: sessions || [] };
    } catch (error) {
      console.error('Get sessions error:', error);
      return { sessions: [] };
    }
  }

  @Post('sessions')
  @ApiOperation({ 
    summary: 'Create a new chat session',
    description: 'Creates a new chat session for the authenticated user'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Chat session created successfully',
    type: ChatSessionDto
  })
  @ApiBody({ type: CreateSessionDto, required: false })
  async createSession(
    @Body() createSessionDto: CreateSessionDto = {},
    @Request() req: AuthenticatedRequest,
  ): Promise<ChatSessionDto> {
    try {
      const userId = req.user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const session = await this.enhancedChatService.createChatSession(
        userId, 
        createSessionDto.title
      );
      return session;
    } catch (error) {
      console.error('Create session error:', error);
      throw new HttpException(
        'Failed to create chat session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ 
    summary: 'Get chat session details',
    description: 'Retrieves details for a specific chat session including messages'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Chat session details retrieved successfully'
  })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  async getSession(
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ session: ChatSessionDto; messages: MessageDto[] }> {
    try {
      const userId = req.user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const result = await this.enhancedChatService.getChatSession(userId, sessionId);
      return result;
    } catch (error) {
      console.error('Get session error:', error);
      throw new HttpException(
        'Failed to retrieve chat session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ 
    summary: 'Delete a chat session',
    description: 'Deletes a chat session and all its messages'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Chat session deleted successfully'
  })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    try {
      const userId = req.user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      await this.enhancedChatService.deleteChatSession(userId, sessionId);
      return { message: 'Chat session deleted successfully' };
    } catch (error) {
      console.error('Delete session error:', error);
      throw new HttpException(
        'Failed to delete chat session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('sessions/:sessionId')
  @ApiOperation({ 
    summary: 'Update a chat session',
    description: 'Updates chat session properties like title'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Chat session updated successfully',
    type: ChatSessionDto
  })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'New session title' }
      }
    }
  })
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() updateData: { title?: string },
    @Request() req: AuthenticatedRequest,
  ): Promise<ChatSessionDto> {
    try {
      const userId = req.user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      console.log(`Updating session ${sessionId} with data:`, updateData);
      
      const updatedSession = await this.enhancedChatService.updateChatSession(
        userId, 
        sessionId, 
        updateData
      );
      
      return updatedSession;
    } catch (error) {
      console.error('Update session error:', error);
      throw new HttpException(
        'Failed to update chat session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sessions/:sessionId/activity')
  @ApiOperation({ 
    summary: 'Update session activity timestamp',
    description: 'Updates the last_message_at timestamp for real-time session ordering'
  })
  @ApiParam({ name: 'sessionId', description: 'Chat session ID' })
  async updateSessionActivityEndpoint(
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; last_message_at: string }> {
    try {
      const userId = req.user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      
      // Update session timestamp manually (useful for real-time sync)
      const { data, error } = await this.enhancedChatService.updateSessionTimestamp(sessionId, userId);
      
      if (error) {
        throw new Error(`Failed to update session activity: ${error}`);
      }

      return {
        success: true,
        last_message_at: data.last_message_at
      };
    } catch (error) {
      console.error('Update session activity error:', error);
      throw new HttpException(
        'Failed to update session activity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private generateSessionTitle(message: string): string {
    const words = message.split(' ').slice(0, 6);
    let title = words.join(' ');
    if (message.split(' ').length > 6) {
      title += '...';
    }
    return title || 'New Conversation';
  }

  private processResponseFormatting(rawResponse: string): string {
    // 🚨 ULTRA-AGGRESSIVE FORMATTING to fix LLM formatting issues
    let formatted = rawResponse;
    
    console.log(`🔧 Processing raw response: "${formatted.substring(0, 200)}..."`);

    // 1. FIRST: Handle multiple asterisks patterns at sentence boundaries
    // Fix patterns like "*****text****" to "**text**"
    formatted = formatted.replace(/\*{3,}([^*]+)\*{3,}/g, '**$1**');
    
    // Fix patterns like "*****text" (opening without proper closing)
    formatted = formatted.replace(/\*{3,}([^*\n]+)/g, '**$1**');
    
    // Fix patterns like "text****" (closing without proper opening)  
    formatted = formatted.replace(/([^*\n]+)\*{3,}/g, '**$1**');
    
    // 2. Clean up any remaining excessive asterisks
    formatted = formatted.replace(/\*{4,}/g, '**'); // Replace 4+ asterisks with proper bold
    formatted = formatted.replace(/\*{3}/g, '**'); // Replace triple asterisks with double
    
    // 3. Fix single asterisks to proper bold format
    formatted = formatted.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '**$1**'); // Convert *text* to **text**
    
    // 4. Remove other inappropriate symbols
    formatted = formatted.replace(/~+/g, ''); // Remove tildes
    formatted = formatted.replace(/[_]{3,}/g, ''); // Remove multiple underscores
    
    // 5. Fix malformed bold at start of response
    formatted = formatted.replace(/^\*+([^*]+)\*+/, '**$1**'); // Fix opening bold
    
    // 6. Ensure Power Move formatting and positioning
    formatted = formatted.replace(/([.!?])\s*(Power Move:)/gi, '$1\n\n**$2**');
    formatted = formatted.replace(/Power Move:/g, 'Power Move:'); // Normalize case
    
    // 7. AGGRESSIVE paragraph breaking for readability
    // Break after 3+ sentences in a row without breaks
    formatted = formatted.replace(/([.!?])\s+([A-Z][^.!?]*[.!?])\s+([A-Z][^.!?]*[.!?])\s+([A-Z])/g, '$1\n\n$2\n\n$3\n\n$4');
    
    // Break long sentences that should be separate thoughts
    formatted = formatted.replace(/([.!?])\s+(However|But|Additionally|Furthermore|Moreover|Therefore|Thus|Consequently)\s+/g, '$1\n\n$2 ');
    formatted = formatted.replace(/([.!?])\s+(Here's|Here are|This|These|The key|Your|You should)\s+/g, '$1\n\n$2 ');
    
    // 8. Ensure numbered lists have proper formatting
    formatted = formatted.replace(/(\d+\.\s*\*\*[^*]+\*\*)/g, '\n\n$1'); // Lists with bold headings
    formatted = formatted.replace(/([.!?])\s*(\d+\.\s)/g, '$1\n\n$2'); // Regular numbered lists
    formatted = formatted.replace(/(\d+\.\s)/g, '$1'); // Clean up
    
    // 9. Ensure bullet points have proper formatting  
    formatted = formatted.replace(/([.!?])\s*([•\-\*]\s)/g, '$1\n\n$2');
    formatted = formatted.replace(/([•\-\*]\s[^•\-\*\n]+)\s*([•\-\*]\s)/g, '$1\n\n$2'); // Separate bullets
    
    // 10. Ensure bold introductions are properly separated
    formatted = formatted.replace(/(\*\*[^*]+\*\*)\s*([A-Z][^*\n]+)/g, '$1\n\n$2');
    
    // 11. Clean up multiple line breaks but preserve intentional structure
    formatted = formatted.replace(/\n{4,}/g, '\n\n\n'); // Max 3 line breaks
    formatted = formatted.replace(/\n{3}/g, '\n\n'); // Convert triple to double
    
    // 12. Ensure proper spacing around sections
    formatted = formatted.replace(/(\*\*[^*]+\*\*)\n([A-Z])/g, '$1\n\n$2'); // Bold headings need space
    formatted = formatted.replace(/([.!?])\n(\*\*)/g, '$1\n\n$2'); // Space before bold sections
    
    // 13. Fix common wall-of-text patterns
    formatted = formatted.replace(/\s+(and\s+then|so\s+you\s+should|while\s+also|because\s+this)\s+/gi, '\n\n'); // Break connecting phrases that create run-ons
    
    // 14. Trim whitespace and normalize
    formatted = formatted.trim();
    
    // 15. Final check for opening bold statement (mandatory format)
    if (!formatted.match(/^\*\*[^*]+\*\*/)) {
      // If response doesn't start with bold, make first sentence bold
      const firstSentence = formatted.match(/^([^.!?]+[.!?])/);
      if (firstSentence) {
        formatted = formatted.replace(/^([^.!?]+[.!?])/, '**$1**');
      }
    }

    console.log(`🔧 BEFORE formatting: "${rawResponse.substring(0, 150)}..."`);
    console.log(`🔧 AFTER formatting: "${formatted.substring(0, 150)}..."`);
    console.log(`🔧 Length change: ${rawResponse.length} → ${formatted.length}`);
    return formatted;
  }
} 