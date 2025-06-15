import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
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
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { assertPromptCredit } from '../../utils/credits';
import { callCoachAssistant } from '../../utils/openai';
import { Tier } from '../../config/plans';

interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@ApiTags('chat')
@Controller('chat')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Send a chat message to the AI coach',
    description: 'Routes the message to the appropriate AI model based on user tier',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'AI response generated successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - upgrade to Power tier for unlimited queries',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Request() req: AuthenticatedRequest,
    @Headers('x-tier') tierHeader?: string,
  ): Promise<ChatResponseDto> {
    try {
      const user = req.user;
      const tier = (tierHeader || "trial") as Tier;
      
      // Check prompt credit using tier-based caps
      await assertPromptCredit(user.id, tier);
      
      // Check if user can make queries (rate limiting)
      const canQuery = await this.chatService.canUserMakeQuery(user);
      if (!canQuery) {
        throw new HttpException(
          {
            message: 'Daily query limit exceeded. Upgrade to Power Strategist for unlimited queries.',
            code: 'QUERY_LIMIT_EXCEEDED',
            upgradeUrl: '/upgrade',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Convert chat request to OpenAI format
      const messages = [
        { role: 'user' as const, content: chatRequest.message }
      ];
      
      // Call OpenAI directly for real AI response
      const openaiResponse = await callCoachAssistant(messages);
      
      // Return the AI response
      return {
        id: `msg_${Date.now()}`,
        message: openaiResponse.choices[0].message.content || "I apologize, but I couldn't generate a response.",
        timestamp: new Date().toISOString(),
        sessionId: chatRequest.sessionId || `session_${Date.now()}`,
        model: "gpt-4o-mini",
        usage: {
          tokensUsed: openaiResponse.usage?.total_tokens || 0,
          remainingQueries: tier === 'shark' ? undefined : 2, // Mock remaining queries
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      console.error('Chat processing error:', error);
      throw new HttpException(
        'An error occurred while processing your request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 