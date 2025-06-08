export interface EmbeddingVector {
  values: number[];
  dimension: number;
}

export interface EmbeddingRequest {
  text: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResponse {
  embedding: EmbeddingVector;
  model: string;
  tokens: number;
  processingTime: number;
}

export interface EmbeddingsBatchRequest {
  texts: string[];
  userId?: string;
  metadata?: Record<string, any>[];
}

export interface EmbeddingsBatchResponse {
  embeddings: EmbeddingVector[];
  model: string;
  totalTokens: number;
  processingTime: number;
}

export enum EmbeddingProvider {
  OPENAI = 'openai',
  COHERE = 'cohere',
  HUGGINGFACE = 'huggingface',
  LOCAL = 'local',
}

export interface EmbeddingsConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey?: string;
  dimension: number;
  maxTokens?: number;
  batchSize?: number;
}

export interface IEmbeddingsService {
  getEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  getBatchEmbeddings(request: EmbeddingsBatchRequest): Promise<EmbeddingsBatchResponse>;
  getConfig(): EmbeddingsConfig;
  validateDimension(embedding: EmbeddingVector): boolean;
} 