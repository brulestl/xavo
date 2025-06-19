import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EnhancedChatService } from './enhanced-chat.service';
import { ModelRouterService } from './model-router.service';
import { ContextInjectionService } from './context-injection.service';
import { SummaryGenerationService } from './summary-generation.service';
import { AuthModule } from '../auth/auth.module';
import { RAGModule } from '../rag/rag.module';

@Module({
  imports: [AuthModule, RAGModule],
  controllers: [ChatController],
  providers: [ChatService, EnhancedChatService, ModelRouterService, ContextInjectionService, SummaryGenerationService],
  exports: [ChatService, EnhancedChatService, ContextInjectionService, SummaryGenerationService],
})
export class ChatModule {} 