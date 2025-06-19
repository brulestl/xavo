import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { streamCoachAssistant } from '../../utils/openai';
import OpenAI from 'openai';

export interface ConversationSummary {
  sessionId: string;
  userId: string;
  summaryText: string;
  keyTopics: string[];
  messageCount: number;
  messageStartId?: string;
  messageEndId?: string;
}

@Injectable()
export class SummaryGenerationService {
  private supabase;
  private openai: OpenAI;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  /**
   * Generate a short-term summary for a conversation session
   */
  async generateSessionSummary(
    sessionId: string, 
    userId: string, 
    triggerMessageCount: number = 3
  ): Promise<ConversationSummary | null> {
    try {
      // 1. Check if we need to generate a summary (minimum message threshold)
      const messages = await this.getRecentMessages(sessionId, userId);
      
      if (messages.length < triggerMessageCount) {
        console.log(`Session ${sessionId} has only ${messages.length} messages, skipping summary generation`);
        return null;
      }

      // 2. Check if we already have a recent summary
      const existingSummary = await this.getLatestSummary(sessionId, userId);
      if (existingSummary && this.isRecentSummary(existingSummary, messages)) {
        console.log(`Session ${sessionId} already has recent summary, skipping`);
        return null;
      }

      // 3. Generate new summary using OpenAI
      const summaryText = await this.generateSummaryText(messages);
      const keyTopics = this.extractKeyTopics(summaryText, messages);

      // 4. Store the summary in database
      const newSummary: ConversationSummary = {
        sessionId,
        userId,
        summaryText,
        keyTopics,
        messageCount: messages.length,
        messageStartId: messages[0]?.id,
        messageEndId: messages[messages.length - 1]?.id
      };

      await this.storeSummary(newSummary);
      console.log(`✅ Generated summary for session ${sessionId}: ${summaryText.substring(0, 100)}...`);

      return newSummary;

    } catch (error) {
      console.error('Error generating session summary:', error);
      return null;
    }
  }

  /**
   * Get recent messages from a session
   */
  private async getRecentMessages(sessionId: string, userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('conversation_messages')
      .select('id, role, content, message_timestamp, created_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('message_timestamp', { ascending: true })
      .limit(20); // Get last 20 messages

    if (error || !data) {
      console.error('Error fetching messages for summary:', error);
      return [];
    }

    return data;
  }

  /**
   * Get the latest summary for a session
   */
  private async getLatestSummary(sessionId: string, userId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('short_term_contexts')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('summary_version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Check if existing summary is recent enough
   */
  private isRecentSummary(existingSummary: any, currentMessages: any[]): boolean {
    // If summary covers most recent messages, don't regenerate
    const summaryMessageCount = existingSummary.message_count || 0;
    const currentMessageCount = currentMessages.length;
    
    // Regenerate if we have 3+ new messages since last summary
    return (currentMessageCount - summaryMessageCount) < 3;
  }

  /**
   * Generate summary text using OpenAI
   */
  private async generateSummaryText(messages: any[]): Promise<string> {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = [
      {
        role: 'system' as const,
        content: `You are creating a concise summary of a corporate coaching conversation. Focus on:
- Key challenges or topics discussed
- User's role/position and situation
- Progress made or insights gained
- Important context for future interactions

Keep the summary under 200 words and focus on actionable context that would help continue the conversation effectively.`
      },
      {
        role: 'user' as const,
        content: `Please summarize this coaching conversation:\n\n${conversationText}`
      }
    ];

    try {
      const completion = await streamCoachAssistant(summaryPrompt);
      let summary = '';
      
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        summary += content;
      }

      return summary.trim();

    } catch (error) {
      console.error('Error generating summary with OpenAI:', error);
      // Fallback: create basic summary
      return this.createFallbackSummary(messages);
    }
  }

  /**
   * Fallback summary generation if OpenAI fails
   */
  private createFallbackSummary(messages: any[]): string {
    const userMessages = messages.filter(msg => msg.role === 'user');
    const topics = userMessages.slice(0, 3).map(msg => 
      msg.content.substring(0, 50).replace(/[.!?].*/, '')
    );

    return `Conversation covered: ${topics.join(', ')}. ${messages.length} messages exchanged. Key focus on corporate coaching and professional development.`;
  }

  /**
   * Extract key topics from summary and messages
   */
  private extractKeyTopics(summaryText: string, messages: any[]): string[] {
    const allText = summaryText + ' ' + messages.map(m => m.content).join(' ');
    
    // Common corporate/coaching topics
    const topicKeywords = [
      'networking', 'leadership', 'communication', 'conflict', 'management',
      'team', 'strategy', 'influence', 'negotiation', 'stakeholder',
      'career', 'promotion', 'feedback', 'performance', 'goals',
      'meeting', 'presentation', 'project', 'decision', 'problem'
    ];

    const extractedTopics = topicKeywords.filter(keyword => 
      allText.toLowerCase().includes(keyword)
    );

    // Limit to 5 most relevant topics
    return extractedTopics.slice(0, 5);
  }

  /**
   * Store summary in database
   */
  private async storeSummary(summary: ConversationSummary): Promise<void> {
    // Generate embedding for the summary
    const summaryEmbedding = await this.generateSummaryEmbedding(summary.summaryText);

    // Get next version number
    const existingSummaries = await this.supabase
      .from('short_term_contexts')
      .select('summary_version')
      .eq('session_id', summary.sessionId)
      .eq('user_id', summary.userId)
      .order('summary_version', { ascending: false })
      .limit(1);

    const nextVersion = existingSummaries.data?.length > 0 
      ? (existingSummaries.data[0].summary_version + 1) 
      : 1;

    const { error } = await this.supabase
      .from('short_term_contexts')
      .insert({
        session_id: summary.sessionId,
        user_id: summary.userId,
        summary_text: summary.summaryText,
        key_topics: summary.keyTopics,
        message_start_id: summary.messageStartId,
        message_end_id: summary.messageEndId,
        message_count: summary.messageCount,
        summary_version: nextVersion,
        context_weight: 1.0,
        context_embedding: summaryEmbedding,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to store summary: ${error.message}`);
    }
  }

  /**
   * Generate embedding for summary text
   */
  private async generateSummaryEmbedding(summaryText: string): Promise<number[] | null> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: summaryText,
        encoding_format: 'float'
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        console.warn('No embedding returned from OpenAI');
        return null;
      }

      console.log(`✅ Generated embedding for summary (${embedding.length} dimensions)`);
      return embedding;

    } catch (error) {
      console.error('Failed to generate summary embedding:', error);
      return null;
    }
  }

  /**
   * Trigger summary generation after conversation
   */
  async triggerSummaryGeneration(
    sessionId: string, 
    userId: string
  ): Promise<void> {
    // Run in background - don't block the response
    setImmediate(async () => {
      try {
        await this.generateSessionSummary(sessionId, userId);
      } catch (error) {
        console.error('Background summary generation failed:', error);
      }
    });
  }

  /**
   * Clean up old summaries (keep only latest 3 per session)
   */
  async cleanupOldSummaries(sessionId: string, userId: string): Promise<void> {
    try {
      const { data: summaries } = await this.supabase
        .from('short_term_contexts')
        .select('id, summary_version')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('summary_version', { ascending: false });

      if (summaries && summaries.length > 3) {
        const toDelete = summaries.slice(3).map(s => s.id);
        
        await this.supabase
          .from('short_term_contexts')
          .delete()
          .in('id', toDelete);

        console.log(`🧹 Cleaned up ${toDelete.length} old summaries for session ${sessionId}`);
      }
    } catch (error) {
      console.warn('Failed to cleanup old summaries:', error);
    }
  }
} 