import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddingsService } from './openai-embeddings.service';
import { IEmbeddingsService, EmbeddingProvider } from './embeddings.interface';

// Factory for creating embeddings service based on configuration
export const EMBEDDINGS_SERVICE = 'EMBEDDINGS_SERVICE';

const embeddingsServiceFactory = {
  provide: EMBEDDINGS_SERVICE,
  useFactory: (configService: ConfigService): IEmbeddingsService => {
    const provider = configService.get<EmbeddingProvider>('EMBEDDING_PROVIDER') || EmbeddingProvider.OPENAI;
    
    switch (provider) {
      case EmbeddingProvider.OPENAI:
        return new OpenAIEmbeddingsService(configService);
      
      // Future providers can be added here
      // case EmbeddingProvider.COHERE:
      //   return new CohereEmbeddingsService(configService);
      // case EmbeddingProvider.HUGGINGFACE:
      //   return new HuggingFaceEmbeddingsService(configService);
      
      default:
        console.warn(`Unknown embedding provider: ${provider}, falling back to OpenAI`);
        return new OpenAIEmbeddingsService(configService);
    }
  },
  inject: [ConfigService],
};

@Module({
  providers: [
    embeddingsServiceFactory,
    OpenAIEmbeddingsService,
  ],
  exports: [EMBEDDINGS_SERVICE],
})
export class EmbeddingsModule {} 