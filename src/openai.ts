import { supabase } from './lib/supabase';

// Legacy OpenAI types for compatibility
export interface OpenAIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call coach assistant using Supabase Edge Functions instead of direct OpenAI
 * This maintains compatibility with existing code while using the secure backend
 */
export async function callCoachAssistant(
  messages: OpenAIChatMessage[]
): Promise<OpenAIResponse> {
  try {
    // Get the current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }

    // Extract the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    // Call the chat Edge Function
    const response = await fetch('https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        message: lastMessage.content,
        actionType: 'general_chat'
      })
    });

    if (!response.ok) {
      throw new Error(`Chat function failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Convert to OpenAI-compatible format
    return {
      choices: [{
        message: {
          content: data.message || 'I apologize, but I encountered an issue generating a response.'
        }
      }]
    };

  } catch (error) {
    console.error('Edge Functions chat error:', error);
    
    // Return fallback response in OpenAI format
    return {
      choices: [{
        message: {
          content: 'I apologize, but I\'m experiencing technical difficulties right now. Please try again in a moment.'
        }
      }]
    };
  }
}

// Legacy export for compatibility (deprecated)
export const openai = {
  chat: {
    completions: {
      create: async (params: any) => {
        console.warn('Direct OpenAI usage is deprecated. Use callCoachAssistant() instead.');
        if (params.messages) {
          return callCoachAssistant(params.messages);
        }
        throw new Error('Invalid OpenAI call parameters');
      }
    }
  }
}; 