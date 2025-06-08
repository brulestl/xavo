import { Module } from '@nestjs/common';
import { RAGService } from './rag.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  providers: [RAGService],
  exports: [RAGService],
})
export class RAGModule {} 