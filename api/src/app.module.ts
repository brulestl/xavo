import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './modules/chat/chat.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { MemoryModule } from './modules/memory/memory.module';
import { RAGModule } from './modules/rag/rag.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    AuthModule,
    EmbeddingsModule,
    MemoryModule,
    RAGModule,
    ChatModule,
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {} 