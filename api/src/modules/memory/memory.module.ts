import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [EmbeddingsModule],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {} 