import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IEmbeddingsService,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingsBatchRequest,
  EmbeddingsBatchResponse,
  EmbeddingsConfig,
  EmbeddingProvider,
  EmbeddingVector,
} from './embeddings.interface';

@Injectable()
export class OpenAIEmbeddingsService implements IEmbeddingsService {
  private openai: OpenAI;
  private config: EmbeddingsConfig;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required for embeddings');
    }

    this.openai = new OpenAI({ apiKey });
    
    this.config = {
      provider: EmbeddingProvider.OPENAI,
      model: 'text-embedding-3-small', // 1536 dimensions, cost-effective
      apiKey,
      dimension: 1536,
      maxTokens: 8192,
      batchSize: 100,
    };
  }

  async getEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: request.text,
        encoding_format: 'float',
      });

      const embedding = response.data[0];
      const processingTime = Date.now() - startTime;

      return {
        embedding: {
          values: embedding.embedding,
          dimension: embedding.embedding.length,
        },
        model: this.config.model,
        tokens: response.usage.total_tokens,
        processingTime,
      };
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBatchEmbeddings(request: EmbeddingsBatchRequest): Promise<EmbeddingsBatchResponse> {
    const startTime = Date.now();
    
    try {
      // Split into batches if needed
      const batches = this.chunkArray(request.texts, this.config.batchSize);
      const allEmbeddings: EmbeddingVector[] = [];
      let totalTokens = 0;

      for (const batch of batches) {
        const response = await this.openai.embeddings.create({
          model: this.config.model,
          input: batch,
          encoding_format: 'float',
        });

        const batchEmbeddings = response.data.map(item => ({
          values: item.embedding,
          dimension: item.embedding.length,
        }));

        allEmbeddings.push(...batchEmbeddings);
        totalTokens += response.usage.total_tokens;
      }

      const processingTime = Date.now() - startTime;

      return {
        embeddings: allEmbeddings,
        model: this.config.model,
        totalTokens,
        processingTime,
      };
    } catch (error) {
      console.error('OpenAI batch embedding error:', error);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getConfig(): EmbeddingsConfig {
    return this.config;
  }

  validateDimension(embedding: EmbeddingVector): boolean {
    return embedding.dimension === this.config.dimension;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
} 