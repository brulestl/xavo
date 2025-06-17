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
      
      // Get OpenAI messages for context
      const openaiMessages = buildChatMessages(message);
      
      // Stream the OpenAI response
      const completion = await streamCoachAssistant(openaiMessages);
      let fullResponse = '';
      
      // Send start streaming event
      res.write(`data: ${JSON.stringify({
        type: 'stream_start'
      })}\n\n`);
      
      for await (const chunk of completion) {
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
      
      // Store the complete assistant message
      try {
        const assistantMessage = await this.storeMessage(
          userId, 
          currentSessionId, 
          fullResponse, 
          'assistant'
        );
        
        // Update session activity
        await this.updateSessionActivity(currentSessionId);
        
        // Send completion event
        res.write(`data: ${JSON.stringify({
          type: 'stream_complete',
          messageId: assistantMessage.id,
          sessionId: currentSessionId,
          fullMessage: fullResponse
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
      
      // Store user message
      let userMessageId = '';
      try {
        const userMessage = await this.storeMessage(userId, currentSessionId, message, 'user');
        userMessageId = userMessage.id;
        console.log(`✅ Stored user message: ${userMessageId}`);
      } catch (error) {
        console.error('Failed to store user message:', error);
        userMessageId = `user_${Date.now()}`;
      }
      
      // Get recent context from session (if available)
      let context = '';
      try {
        const sessionData = await this.enhancedChatService.getChatSession(userId, currentSessionId);
        const recentMessages = sessionData.messages.slice(-10);
        context = this.buildContextFromMessages(recentMessages);
      } catch (error) {
        console.log('No previous context available, starting fresh conversation');
      }
      
      // Build OpenAI messages with context
      const openaiMessages = buildChatMessages(message, context);
      
      // Get streaming response and collect it
      console.log('🤖 Calling OpenAI...');
      const completion = await streamCoachAssistant(openaiMessages);
      
      // Collect the full response
      let fullResponse = '';
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
      }
      
      console.log(`✅ Generated response: "${fullResponse.substring(0, 100)}..."`);
      
      // Store assistant message
      let assistantMessageId = '';
      try {
        const assistantMessage = await this.storeMessage(
          userId, 
          currentSessionId, 
          fullResponse, 
          'assistant'
        );
        assistantMessageId = assistantMessage.id;
        console.log(`✅ Stored assistant message: ${assistantMessageId}`);
        
        // Update session activity
        await this.updateSessionActivity(currentSessionId);
      } catch (error) {
        console.error('Failed to store assistant message:', error);
        assistantMessageId = `assistant_${Date.now()}`;
      }
      
      return {
        id: assistantMessageId,
        message: fullResponse,
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId,
        model: 'gpt-4o-mini',
        usage: {
          tokensUsed: Math.ceil(fullResponse.length / 4), // Rough estimation
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
    role: 'user' | 'assistant'
  ): Promise<{ id: string; created_at: string }> {
    return await this.enhancedChatService.storeMessage(userId, sessionId, content, role);
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

  private generateSessionTitle(message: string): string {
    const words = message.split(' ').slice(0, 6);
    let title = words.join(' ');
    if (message.split(' ').length > 6) {
      title += '...';
    }
    return title || 'New Conversation';
  }
} 