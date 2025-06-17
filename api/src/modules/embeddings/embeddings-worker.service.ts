import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

interface EmbeddingJob {
  messageId: string;
  content: string;
  userId: string;
  sessionId: string;
}

@Injectable()
export class EmbeddingsWorkerService implements OnModuleInit, OnModuleDestroy {
  private supabase: SupabaseClient;
  private openai: OpenAI | null = null;
  private redis: Redis | null = null;
  private embeddingQueue: Queue | null = null;
  private embeddingWorker: Worker | null = null;
  private isRedisAvailable = false;

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    // OpenAI client will be initialized lazily when needed
    // Redis will be initialized in onModuleInit to handle connection failures gracefully
  }

  async onModuleInit() {
    // Disable Redis and embeddings for now to prevent connection errors
    console.log('Embeddings worker service: Redis disabled for testing');
    this.isRedisAvailable = false;
    this.redis = null;
    this.embeddingQueue = null;
    
    console.log('Embeddings worker service initialized in disabled mode');
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Initialize Redis connection
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 5000, // 5 second timeout
        lazyConnect: true, // Don't connect immediately
      });

      // Test the connection
      await this.redis.connect();
      await this.redis.ping();

      // Initialize BullMQ queue
      this.embeddingQueue = new Queue('embeddings', {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      this.isRedisAvailable = true;
      console.log('Redis connection established successfully');
    } catch (error) {
      console.warn('Redis not available, running embeddings service in stub mode:', error instanceof Error ? error.message : String(error));
      this.isRedisAvailable = false;
      this.redis = null;
      this.embeddingQueue = null;
    }
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set. Embeddings feature requires OpenAI API key.');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  async onModuleDestroy() {
    // Clean shutdown
    if (this.embeddingWorker) {
      await this.embeddingWorker.close();
    }
    if (this.embeddingQueue) {
      await this.embeddingQueue.close();
    }
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  private async startNotificationListener() {
    try {
      // Subscribe to PostgreSQL notifications for new messages
      const channel = this.supabase.channel('message-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_messages'
          },
          (payload) => this.handleNewMessage(payload)
        )
        .subscribe();

      console.log('Started listening for new message notifications');
    } catch (error) {
      console.error('Failed to start notification listener:', error);
    }
  }

  private async handleNewMessage(payload: any) {
    try {
      const newMessage = payload.new;
      
      // Only process messages that don't already have embeddings
      if (newMessage.content_embedding) {
        return;
      }

      // If Redis is not available, skip queuing
      if (!this.isRedisAvailable || !this.embeddingQueue) {
        console.log(`Redis not available, skipping embedding job for message ${newMessage.id}`);
        return;
      }

      // Add job to embedding queue
      await this.embeddingQueue.add('generate-embedding', {
        messageId: newMessage.id,
        content: newMessage.content,
        userId: newMessage.user_id,
        sessionId: newMessage.session_id,
      } as EmbeddingJob, {
        // Add delay to avoid rate limiting
        delay: Math.random() * 1000, // 0-1 second random delay
      });

      console.log(`Queued embedding job for message ${newMessage.id}`);
    } catch (error) {
      console.error('Error handling new message notification:', error);
    }
  }

  private async processEmbeddingJob(job: Job<EmbeddingJob>): Promise<void> {
    const { messageId, content, userId, sessionId } = job.data;

    try {
      // Update job progress
      await job.updateProgress(10);

      // Generate embedding using OpenAI
      const embedding = await this.generateEmbedding(content);
      await job.updateProgress(70);

      // Update the message with the embedding
      await this.updateMessageEmbedding(messageId, embedding);
      await job.updateProgress(90);

      // Also check if we should generate embeddings for any related memories
      await this.processRelatedMemories(userId, sessionId, content);
      await job.updateProgress(100);

      console.log(`Successfully generated embedding for message ${messageId}`);
    } catch (error) {
      console.error(`Failed to process embedding job for message ${messageId}:`, error);
      throw error; // Re-throw to trigger retry mechanism
    }
  }

  private async generateEmbedding(content: string): Promise<number[]> {
    try {
      // Clean and prepare content for embedding
      const cleanContent = this.cleanContentForEmbedding(content);

      // Call OpenAI Embeddings API
      const response = await this.getOpenAI().embeddings.create({
        model: 'text-embedding-3-small', // More cost-effective than ada-002
        input: cleanContent,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private cleanContentForEmbedding(content: string): string {
    // Remove excessive whitespace and normalize text
    return content
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 8000); // Limit to reasonable length for embeddings
  }

  private async updateMessageEmbedding(messageId: string, embedding: number[]): Promise<void> {
    const { error } = await this.supabase
      .from('conversation_messages')
      .update({ content_embedding: embedding })
      .eq('id', messageId);

    if (error) {
      throw new Error(`Failed to update message embedding: ${error.message}`);
    }
  }

  private async processRelatedMemories(
    userId: string, 
    sessionId: string, 
    content: string
  ): Promise<void> {
    try {
      // Check if there are any short-term contexts that need embeddings
      const { data: contexts } = await this.supabase
        .from('short_term_contexts')
        .select('id, summary_text')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .is('summary_embedding', null)
        .limit(5);

      if (contexts && contexts.length > 0) {
        // Generate embeddings for contexts that don't have them
        for (const context of contexts) {
          try {
            const embedding = await this.generateEmbedding(context.summary_text);
            
            await this.supabase
              .from('short_term_contexts')
              .update({ summary_embedding: embedding })
              .eq('id', context.id);

            console.log(`Generated embedding for context ${context.id}`);
          } catch (error) {
            console.warn(`Failed to generate embedding for context ${context.id}:`, error);
          }
        }
      }

      // Check for long-term memories without embeddings
      const { data: memories } = await this.supabase
        .from('long_term_memories')
        .select('id, memory_content')
        .eq('user_id', userId)
        .is('memory_embedding', null)
        .limit(3);

      if (memories && memories.length > 0) {
        for (const memory of memories) {
          try {
            const embedding = await this.generateEmbedding(memory.memory_content);
            
            await this.supabase
              .from('long_term_memories')
              .update({ memory_embedding: embedding })
              .eq('id', memory.id);

            console.log(`Generated embedding for memory ${memory.id}`);
          } catch (error) {
            console.warn(`Failed to generate embedding for memory ${memory.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Error processing related memories:', error);
      // Don't throw here as this is supplementary work
    }
  }

  // Public method to manually queue embedding generation
  async queueEmbeddingGeneration(messageId: string, content: string, userId: string, sessionId: string): Promise<void> {
    if (!this.isRedisAvailable || !this.embeddingQueue) {
      console.log(`Redis not available, skipping manual embedding job for message ${messageId}`);
      return;
    }
    
    await this.embeddingQueue.add('generate-embedding', {
      messageId,
      content,
      userId,
      sessionId,
    } as EmbeddingJob);
  }

  // Public method to get queue status
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (!this.isRedisAvailable || !this.embeddingQueue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
    }

    const waiting = await this.embeddingQueue.getWaiting();
    const active = await this.embeddingQueue.getActive();
    const completed = await this.embeddingQueue.getCompleted();
    const failed = await this.embeddingQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
} 