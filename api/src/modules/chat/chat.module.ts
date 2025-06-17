import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EnhancedChatService } from './enhanced-chat.service';
import { ModelRouterService } from './model-router.service';
import { AuthModule } from '../auth/auth.module';
import { RAGModule } from '../rag/rag.module';

@Module({
  imports: [AuthModule, RAGModule],
  controllers: [ChatController],
  providers: [ChatService, EnhancedChatService, ModelRouterService],
  exports: [ChatService, EnhancedChatService],
})
export class ChatModule {} 