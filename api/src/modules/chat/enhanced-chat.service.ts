import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { 
  ConversationSessionDto,
  ConversationMessageDto,
  CreateMessageDto,
  CreateSessionDto,
  ChatResponseDto,
  SessionListDto,
  SessionDetailDto,
  SendMessageDto,
  ChatSessionDto,
  MessageDto
} from './dto/enhanced-chat.dto';
import { ContextBuilderUtil, UserContext } from '../../utils/context-builder.util';
import { OpenAIFunctionTools } from './openai-function-tools';

@Injectable()
export class EnhancedChatService {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private contextBuilder: ContextBuilderUtil;
  private functionTools: OpenAIFunctionTools;

  constructor() {
    // TODO: Move to config service
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    this.contextBuilder = new ContextBuilderUtil();
    this.functionTools = new OpenAIFunctionTools();
  }

  async sendMessage(userId: string, sendMessageDto: SendMessageDto): Promise<MessageDto> {
    const { content, session_id } = sendMessageDto;

    try {
      // 1. Store user message
      const userMessage = await this.storeMessage(userId, session_id, content, 'user');

      // 2. Generate embedding for the user message
      const messageEmbedding = await this.generateEmbedding(content);
      await this.updateMessageEmbedding(userMessage.id, messageEmbedding);

      // 3. Build comprehensive context
      const userContext = await this.contextBuilder.buildUserContext(
        userId,
        session_id,
        content,
        messageEmbedding
      );

      // 4. Generate AI response with function calling
      const aiResponse = await this.generateAIResponse(
        userId,
        session_id,
        content,
        userContext
      );

      // 5. Store AI response
      const assistantMessage = await this.storeMessage(
        userId,
        session_id,
        aiResponse.content,
        'assistant'
      );

      // 6. Generate embedding for AI response
      const responseEmbedding = await this.generateEmbedding(aiResponse.content);
      await this.updateMessageEmbedding(assistantMessage.id, responseEmbedding);

      // 7. Execute any function calls that were made
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        await this.executeFunctionCalls(aiResponse.functionCalls, userId, session_id);
      }

      // 8. Update session activity
      await this.updateSessionActivity(session_id);

      return {
        id: assistantMessage.id,
        content: aiResponse.content,
        role: 'assistant',
        session_id,
        created_at: assistantMessage.created_at,
        function_calls: aiResponse.functionCalls || []
      };

    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw new Error(`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createSession(userId: string, createSessionDto: CreateSessionDto): Promise<ConversationSessionDto> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .insert({
        user_id: userId,
        title: createSessionDto.title || 'New Conversation',
        context: createSessionDto.context,
        metadata: createSessionDto.metadata || {},
        is_active: true,
        message_count: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return data;
  }

  async getSessions(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<SessionListDto> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('conversation_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    return {
      sessions: data || [],
      total: count || 0,
      page,
      limit
    };
  }

  async getSession(userId: string, sessionId: string): Promise<ConversationSessionDto | null> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    return data;
  }

  async getSessionDetail(userId: string, sessionId: string): Promise<SessionDetailDto | null> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return null;

    // Get messages
    const { data: messages, error: messagesError } = await this.supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('message_timestamp', { ascending: true });

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    // Get summaries
    const { data: summaries } = await this.supabase
      .from('short_term_contexts')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('summary_version', { ascending: false });

    return {
      session,
      messages: messages || [],
      summaries: summaries || []
    };
  }

  private async storeMessage(
    userId: string,
    sessionId: string,
    content: string,
    role: 'user' | 'assistant'
  ): Promise<{ id: string; created_at: string }> {
    const { data, error } = await this.supabase
      .from('conversation_messages')
      .insert({
        user_id: userId,
        session_id: sessionId,
        content,
        role,
        created_at: new Date().toISOString()
      })
      .select('id, created_at')
      .single();

    if (error) {
      throw new Error(`Failed to store message: ${error.message}`);
    }

    return data;
  }

  private async updateMessageEmbedding(messageId: string, embedding: number[]): Promise<void> {
    const { error } = await this.supabase
      .from('conversation_messages')
      .update({ content_embedding: embedding })
      .eq('id', messageId);

    if (error) {
      console.warn(`Failed to update message embedding: ${error.message}`);
    }
  }

  private async generateEmbedding(content: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content.trim().substring(0, 8000), // Limit content length
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  private async generateAIResponse(
    userId: string,
    sessionId: string,
    userMessage: string,
    context: UserContext
  ): Promise<{ content: string; functionCalls?: any[] }> {
    try {
      // Build system prompt with context
      const systemPrompt = this.contextBuilder.buildSystemPrompt(context, userMessage);

      // Get available tools
      const tools = this.functionTools.getAvailableTools();

      // Call OpenAI with function calling
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview', // Use GPT-4 for better function calling
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        tools: tools,
        tool_choice: 'auto', // Let the model decide when to use tools
        temperature: 0.7,
        max_tokens: 1000
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error('No response from OpenAI');
      }

      const response = {
        content: message.content || 'I apologize, but I encountered an issue generating a response.',
        functionCalls: message.tool_calls || []
      };

      return response;

    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Fallback response
      return {
        content: 'I apologize, but I\'m experiencing technical difficulties right now. Please try again in a moment.',
        functionCalls: []
      };
    }
  }

  private async executeFunctionCalls(functionCalls: any[], userId: string, sessionId: string): Promise<void> {
    for (const toolCall of functionCalls) {
      try {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`Executing function call: ${functionName}`, args);

        const result = await this.functionTools.executeToolCall(
          functionName,
          args,
          userId,
          sessionId
        );

        if (result.success) {
          console.log(`Function call ${functionName} executed successfully:`, result.data);
        } else {
          console.error(`Function call ${functionName} failed:`, result.error);
        }

      } catch (error) {
        console.error(`Error executing function call:`, error);
      }
    }
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversation_sessions')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.warn(`Failed to update session activity: ${error.message}`);
    }
  }

  async getChatSessions(userId: string): Promise<ChatSessionDto[]> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .select(`
        id,
        title,
        created_at,
        last_message_at,
        message_count
      `)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch chat sessions: ${error.message}`);
    }

    return data || [];
  }

  async getChatSession(userId: string, sessionId: string): Promise<{
    session: ChatSessionDto;
    messages: MessageDto[];
  }> {
    // Get session details
    const { data: session, error: sessionError } = await this.supabase
      .from('conversation_sessions')
      .select('id, title, created_at, last_message_at, message_count')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError) {
      throw new Error(`Failed to fetch session: ${sessionError.message}`);
    }

    // Get messages for the session
    const { data: messages, error: messagesError } = await this.supabase
      .from('conversation_messages')
      .select('id, content, role, created_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    return {
      session,
      messages: messages?.map(msg => ({
        ...msg,
        session_id: sessionId,
        function_calls: []
      })) || []
    };
  }

  async createChatSession(userId: string, title?: string): Promise<ChatSessionDto> {
    const { data, error } = await this.supabase
      .from('conversation_sessions')
      .insert({
        user_id: userId,
        title: title || 'New Conversation',
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        message_count: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }

    return data;
  }

  async deleteChatSession(userId: string, sessionId: string): Promise<void> {
    // First delete all messages in the session
    const { error: messagesError } = await this.supabase
      .from('conversation_messages')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (messagesError) {
      throw new Error(`Failed to delete session messages: ${messagesError.message}`);
    }

    // Then delete the session
    const { error: sessionError } = await this.supabase
      .from('conversation_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (sessionError) {
      throw new Error(`Failed to delete session: ${sessionError.message}`);
    }
  }

  // Health check method for monitoring
  async getServiceHealth(): Promise<{
    status: string;
    openai_available: boolean;
    supabase_available: boolean;
    context_builder_available: boolean;
    function_tools_available: boolean;
  }> {
    const health = {
      status: 'healthy',
      openai_available: false,
      supabase_available: false,
      context_builder_available: false,
      function_tools_available: false
    };

    try {
      // Test Supabase connection
      const { error: supabaseError } = await this.supabase
        .from('conversation_sessions')
        .select('id')
        .limit(1);
      
      health.supabase_available = !supabaseError;
    } catch (error) {
      health.supabase_available = false;
    }

    try {
      // Test OpenAI connection (simple embedding call)
      await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'test',
      });
      health.openai_available = true;
    } catch (error) {
      health.openai_available = false;
    }

    // Test context builder and function tools
    health.context_builder_available = !!this.contextBuilder;
    health.function_tools_available = !!this.functionTools;

    // Overall status
    const allHealthy = Object.values(health).every(value => 
      typeof value === 'boolean' ? value : true
    );
    
    health.status = allHealthy ? 'healthy' : 'degraded';

    return health;
  }
} 