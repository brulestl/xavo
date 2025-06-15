import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateUUID } from './uuid-validator.util';

export interface UserContext {
  shortTermContexts: ShortTermContext[];
  similarMessages: SimilarMessage[];
  similarMemories: SimilarMemory[];
  personalitySnapshot: PersonalitySnapshot;
  userPersonalization: UserPersonalization;
}

export interface ShortTermContext {
  id: string;
  summary_text: string;
  context_type: string;
  last_accessed: string;
  message_count: number;
}

export interface SimilarMessage {
  id: string;
  content: string;
  role: string;
  created_at: string;
  similarity_score: number;
}

export interface SimilarMemory {
  id: string;
  memory_content: string;
  memory_type: string;
  importance_score: number;
  created_at: string;
  similarity_score: number;
}

export interface PersonalitySnapshot {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  last_updated: string;
}

export interface UserPersonalization {
  communication_style: string;
  preferred_topics: string[];
  goals: string[];
  learning_preferences: string[];
  timezone: string;
  language: string;
}

export class ContextBuilderUtil {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }

  /**
   * Build comprehensive context for the AI assistant
   */
  async buildUserContext(
    userId: string,
    sessionId: string,
    currentMessage: string,
    messageEmbedding?: number[]
  ): Promise<UserContext> {
    // Validate UUID format
    validateUUID(userId, 'user_id');
    try {
      // Fetch all context components in parallel for efficiency
      const [
        shortTermContexts,
        similarMessages,
        similarMemories,
        personalitySnapshot,
        userPersonalization
      ] = await Promise.all([
        this.getShortTermContexts(userId, sessionId),
        this.getSimilarMessages(userId, currentMessage, messageEmbedding),
        this.getSimilarMemories(userId, currentMessage, messageEmbedding),
        this.getPersonalitySnapshot(userId),
        this.getUserPersonalization(userId)
      ]);

      return {
        shortTermContexts,
        similarMessages,
        similarMemories,
        personalitySnapshot,
        userPersonalization
      };
    } catch (error) {
      console.error('Error building user context:', error);
      // Return minimal context on error
      return {
        shortTermContexts: [],
        similarMessages: [],
        similarMemories: [],
        personalitySnapshot: {
          openness: 0.5,
          conscientiousness: 0.5,
          extraversion: 0.5,
          agreeableness: 0.5,
          neuroticism: 0.5,
          last_updated: new Date().toISOString()
        },
        userPersonalization: {
          communication_style: 'professional',
          preferred_topics: [],
          goals: [],
          learning_preferences: [],
          timezone: 'UTC',
          language: 'en'
        }
      };
    }
  }

  /**
   * Get the last two short-term contexts by last_accessed
   */
  private async getShortTermContexts(userId: string, sessionId: string): Promise<ShortTermContext[]> {
    const { data, error } = await this.supabase
      .from('short_term_contexts')
      .select('id, summary_text, context_type, last_accessed, message_count')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('last_accessed', { ascending: false })
      .limit(2);

    if (error) {
      console.warn('Error fetching short-term contexts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get top-3 similar messages using vector similarity or text search
   */
  private async getSimilarMessages(
    userId: string,
    currentMessage: string,
    messageEmbedding?: number[]
  ): Promise<SimilarMessage[]> {
    try {
      if (messageEmbedding && messageEmbedding.length > 0) {
        // Use vector similarity search
        const { data, error } = await this.supabase.rpc('search_similar_messages', {
          p_user_id: userId,
          p_query_embedding: messageEmbedding,
          p_match_threshold: 0.7,
          p_match_count: 3
        });

        if (error) {
          console.warn('Vector similarity search failed, falling back to text search:', error);
          return await this.getTextSimilarMessages(userId, currentMessage);
        }

        return data?.map((row: any) => ({
          id: row.id,
          content: row.content,
          role: row.role,
          created_at: row.created_at,
          similarity_score: row.similarity_score
        })) || [];
      } else {
        // Fallback to text-based search
        return await this.getTextSimilarMessages(userId, currentMessage);
      }
    } catch (error) {
      console.warn('Error in similar messages search:', error);
      return [];
    }
  }

  /**
   * Fallback text-based message search
   */
  private async getTextSimilarMessages(userId: string, currentMessage: string): Promise<SimilarMessage[]> {
    // Extract key terms from current message for search
    const searchTerms = this.extractSearchTerms(currentMessage);
    
    if (searchTerms.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('conversation_messages')
      .select('id, content, role, created_at')
      .eq('user_id', userId)
      .textSearch('content', searchTerms.join(' | '))
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.warn('Text search for similar messages failed:', error);
      return [];
    }

    return data?.map(msg => ({
      ...msg,
      similarity_score: 0.5 // Default score for text search
    })) || [];
  }

  /**
   * Get top-3 similar memories using vector similarity or text search
   */
  private async getSimilarMemories(
    userId: string,
    currentMessage: string,
    messageEmbedding?: number[]
  ): Promise<SimilarMemory[]> {
    try {
      if (messageEmbedding && messageEmbedding.length > 0) {
        // Use vector similarity search
        const { data, error } = await this.supabase.rpc('search_similar_memories', {
          p_user_id: userId,
          p_query_embedding: messageEmbedding,
          p_match_threshold: 0.7,
          p_match_count: 3
        });

        if (error) {
          console.warn('Vector memory search failed, falling back to text search:', error);
          return await this.getTextSimilarMemories(userId, currentMessage);
        }

        return data?.map((row: any) => ({
          id: row.id,
          memory_content: row.memory_content,
          memory_type: row.memory_type,
          importance_score: row.importance_score,
          created_at: row.created_at,
          similarity_score: row.similarity_score
        })) || [];
      } else {
        // Fallback to text-based search
        return await this.getTextSimilarMemories(userId, currentMessage);
      }
    } catch (error) {
      console.warn('Error in similar memories search:', error);
      return [];
    }
  }

  /**
   * Fallback text-based memory search
   */
  private async getTextSimilarMemories(userId: string, currentMessage: string): Promise<SimilarMemory[]> {
    const searchTerms = this.extractSearchTerms(currentMessage);
    
    if (searchTerms.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('long_term_memories')
      .select('id, memory_content, memory_type, importance_score, created_at')
      .eq('user_id', userId)
      .textSearch('memory_content', searchTerms.join(' | '))
      .order('importance_score', { ascending: false })
      .limit(3);

    if (error) {
      console.warn('Text search for similar memories failed:', error);
      return [];
    }

    return data?.map(memory => ({
      ...memory,
      similarity_score: 0.5 // Default score for text search
    })) || [];
  }

  /**
   * Get user's personality snapshot
   */
  private async getPersonalitySnapshot(userId: string): Promise<PersonalitySnapshot> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('openness, conscientiousness, extraversion, agreeableness, neuroticism, updated_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.warn('Error fetching personality snapshot:', error);
      // Return neutral personality scores
      return {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5,
        last_updated: new Date().toISOString()
      };
    }

    return {
      openness: data.openness || 0.5,
      conscientiousness: data.conscientiousness || 0.5,
      extraversion: data.extraversion || 0.5,
      agreeableness: data.agreeableness || 0.5,
      neuroticism: data.neuroticism || 0.5,
      last_updated: data.updated_at || new Date().toISOString()
    };
  }

  /**
   * Get user personalization settings
   */
  private async getUserPersonalization(userId: string): Promise<UserPersonalization> {
    const { data, error } = await this.supabase
      .from('user_personalization')
      .select('communication_style, preferred_topics, goals, learning_preferences, timezone, language')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching user personalization:', { code: error.code, message: error.message, details: error.details });
    }

    if (!data) {
      return {
        communication_style: 'professional',
        preferred_topics: [],
        goals: [],
        learning_preferences: [],
        timezone: 'UTC',
        language: 'en'
      };
    }

    return {
      communication_style: data.communication_style || 'professional',
      preferred_topics: data.preferred_topics || [],
      goals: data.goals || [],
      learning_preferences: data.learning_preferences || [],
      timezone: data.timezone || 'UTC',
      language: data.language || 'en'
    };
  }

  /**
   * Extract meaningful search terms from a message
   */
  private extractSearchTerms(message: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ]);

    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Limit to top 5 terms
  }

  /**
   * Build system prompt with all context
   */
  buildSystemPrompt(context: UserContext, currentMessage: string): string {
    const {
      shortTermContexts,
      similarMessages,
      similarMemories,
      personalitySnapshot,
      userPersonalization
    } = context;

    let systemPrompt = `You are a Corporate Influence Coach AI assistant. Your role is to help users develop their influence and leadership skills in professional settings.

## User Profile:
- Communication Style: ${userPersonalization.communication_style}
- Preferred Topics: ${userPersonalization.preferred_topics.join(', ') || 'General leadership'}
- Goals: ${userPersonalization.goals.join(', ') || 'Professional development'}
- Learning Preferences: ${userPersonalization.learning_preferences.join(', ') || 'Interactive'}
- Timezone: ${userPersonalization.timezone}
- Language: ${userPersonalization.language}

## Personality Profile (Big Five):
- Openness: ${(personalitySnapshot.openness * 100).toFixed(0)}%
- Conscientiousness: ${(personalitySnapshot.conscientiousness * 100).toFixed(0)}%
- Extraversion: ${(personalitySnapshot.extraversion * 100).toFixed(0)}%
- Agreeableness: ${(personalitySnapshot.agreeableness * 100).toFixed(0)}%
- Neuroticism: ${(personalitySnapshot.neuroticism * 100).toFixed(0)}%

`;

    // Add recent conversation context
    if (shortTermContexts.length > 0) {
      systemPrompt += `## Recent Conversation Context:
`;
      shortTermContexts.forEach((context, index) => {
        systemPrompt += `${index + 1}. ${context.context_type}: ${context.summary_text} (${context.message_count} messages)\n`;
      });
      systemPrompt += '\n';
    }

    // Add similar past conversations
    if (similarMessages.length > 0) {
      systemPrompt += `## Relevant Past Conversations:
`;
      similarMessages.forEach((msg, index) => {
        systemPrompt += `${index + 1}. [${msg.role}]: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
      });
      systemPrompt += '\n';
    }

    // Add relevant memories
    if (similarMemories.length > 0) {
      systemPrompt += `## Relevant Memories:
`;
      similarMemories.forEach((memory, index) => {
        systemPrompt += `${index + 1}. ${memory.memory_type}: ${memory.memory_content} (Importance: ${memory.importance_score}/10)\n`;
      });
      systemPrompt += '\n';
    }

    systemPrompt += `## Instructions:
- Adapt your communication style to match the user's preferences
- Reference relevant past conversations and memories when appropriate
- Consider the user's personality profile when providing advice
- Focus on practical, actionable influence and leadership strategies
- Use the available tools to save important insights and update user goals
- Be encouraging and supportive while maintaining professionalism

Current user message: "${currentMessage}"

Please provide a helpful, personalized response based on the context above.`;

    return systemPrompt;
  }
} 