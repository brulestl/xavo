import { useState, useCallback } from 'react';
import useSWRMutation from 'swr/mutation';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isOptimistic?: boolean;
}

interface ChatResponse {
  message: string;
  action?: string;
  conversationId?: string;
}

interface SendMessageArgs {
  message: string;
  action?: string;
  conversationId?: string;
}

async function sendChatRequest(url: string, { arg }: { arg: SendMessageArgs }) {
  const { message, action, conversationId } = arg;
  
  return await apiFetch<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      action,
      conversationId,
    }),
  });
}

export function useChat(conversationId?: string) {
  const { user, tier, canMakeQuery, incrementQueryCount } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const {
    trigger: sendChatMessage,
    isMutating: isSending,
    error,
  } = useSWRMutation('/api/chat', sendChatRequest);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const sendMessage = useCallback(async (content: string, action?: string) => {
    if (!canMakeQuery()) {
      throw new Error('Query limit reached');
    }

    // Add optimistic user message
    const userMessage = addMessage({
      role: 'user',
      content,
      isOptimistic: true,
    });

    // Show typing indicator
    setIsTyping(true);

    try {
      // Send to API
      const response = await sendChatMessage({
        message: content,
        action,
        conversationId,
      });

      // Remove optimistic flag from user message
      updateMessage(userMessage.id, { isOptimistic: false });

      // Add assistant response
      addMessage({
        role: 'assistant',
        content: response.message,
      });

      // Increment query count
      await incrementQueryCount();

      return response;
    } catch (error) {
      // Remove optimistic message on error
      removeMessage(userMessage.id);
      throw error;
    } finally {
      setIsTyping(false);
    }
  }, [canMakeQuery, addMessage, updateMessage, removeMessage, sendChatMessage, conversationId, incrementQueryCount]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isTyping,
    isSending,
    error,
    sendMessage,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    canSendMessage: canMakeQuery(),
  };
}