import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

export interface ConversationContext {
  shortTermSummary?: string;
  messageHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  contextTokens: number;
}

@Injectable()
export class ContextInjectionService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Fetch and format conversation context for a session
   */
  async getSessionContext(
    sessionId: string, 
    userId: string, 
    maxMessages: number = 10
  ): Promise<ConversationContext> {
    try {
      console.log(`🔍 Fetching context for session ${sessionId}, max messages: ${maxMessages}`);

      // 1. Fetch the latest short-term summary for this session
      const shortTermSummary = await this.getLatestShortTermSummary(sessionId, userId);

      // 2. Fetch recent conversation messages
      const messageHistory = await this.getRecentMessages(sessionId, userId, maxMessages);

      // 3. Calculate approximate token count
      const contextTokens = this.estimateTokenCount(shortTermSummary, messageHistory);

      console.log(`📊 Context retrieved: ${shortTermSummary ? 'Summary available' : 'No summary'}, ${messageHistory.length} messages, ~${contextTokens} tokens`);

      return {
        shortTermSummary,
        messageHistory,
        contextTokens
      };

    } catch (error) {
      console.error('Error fetching session context:', error);
      return {
        messageHistory: [],
        contextTokens: 0
      };
    }
  }

  /**
   * Get the latest short-term summary for a session
   */
  private async getLatestShortTermSummary(
    sessionId: string, 
    userId: string
  ): Promise<string | undefined> {
    try {
      const { data, error } = await this.supabase
        .from('short_term_contexts')
        .select('summary_text, key_topics, created_at')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('summary_version', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log(`No short-term summary found for session ${sessionId}`);
        return undefined;
      }

      // Format the summary with key topics if available
      let formattedSummary = data.summary_text;
      if (data.key_topics && data.key_topics.length > 0) {
        formattedSummary += `\nKey topics discussed: ${data.key_topics.join(', ')}`;
      }

      return formattedSummary;

    } catch (error) {
      console.error('Error fetching short-term summary:', error);
      return undefined;
    }
  }

  /**
   * Get recent conversation messages for a session
   */
  private async getRecentMessages(
    sessionId: string, 
    userId: string, 
    maxMessages: number
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_messages')
        .select('role, content, message_timestamp, created_at')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .in('role', ['user', 'assistant'])
        .order('message_timestamp', { ascending: true })
        .limit(maxMessages);

      if (error || !data) {
        console.log(`No message history found for session ${sessionId}`);
        return [];
      }

      return data.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.message_timestamp || msg.created_at
      }));

    } catch (error) {
      console.error('Error fetching message history:', error);
      return [];
    }
  }

  /**
   * Estimate token count for context
   */
  private estimateTokenCount(
    shortTermSummary: string | undefined, 
    messageHistory: Array<{ content: string }>
  ): number {
    const summaryTokens = shortTermSummary ? Math.ceil(shortTermSummary.length / 4) : 0;
    const historyTokens = messageHistory.reduce((acc, msg) => 
      acc + Math.ceil(msg.content.length / 4), 0
    );
    
    return summaryTokens + historyTokens;
  }

  /**
   * Format context for injection into OpenAI messages
   */
  formatContextForOpenAI(context: ConversationContext): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // 1. Add short-term summary as system message if available
    if (context.shortTermSummary) {
      messages.push({
        role: 'system',
        content: `SYSTEM: Short-term summary: ${context.shortTermSummary}`
      });
    }

    // 2. Add recent message history in chronological order
    context.messageHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    return messages;
  }

  /**
   * Update context access timestamp
   */
  async updateContextAccess(sessionId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('short_term_contexts')
        .update({ last_accessed: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) {
        console.warn('Failed to update context access timestamp:', error);
      }
    } catch (error) {
      console.warn('Error updating context access:', error);
    }
  }
} 