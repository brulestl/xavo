import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  lastMessage: string;
  timestamp: string;
  messages: Message[];
}

interface ConversationSession {
  id: string;
  title?: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
  user_id: string;
  is_active: boolean;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  // Load conversations from Supabase
  const loadConversations = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('id, title, created_at, last_message_at, message_count')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading conversations:', error);
        return;
      }

      // Convert to local format
      const formattedConversations: Conversation[] = (data || []).map(session => ({
        id: session.id,
        title: session.title || 'Untitled Conversation',
        preview: session.title || 'Conversation',
        lastMessage: '',
        timestamp: session.last_message_at || session.created_at,
        messages: []
      }));

      setConversations(formattedConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load conversations when user changes
  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
  }, [user?.id]);

  const getConversation = (id: string): Conversation | undefined => {
    return conversations.find(conv => conv.id === id);
  };

  const createConversation = (firstMessage: string): Conversation => {
    // This will be created by the API, so we just return a placeholder
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : ''),
      preview: firstMessage,
      lastMessage: '',
      timestamp: new Date().toISOString(),
      messages: [
        {
          id: `msg_${Date.now()}_1`,
          role: 'user',
          content: firstMessage,
          timestamp: new Date().toISOString()
        }
      ]
    };

    setConversations(prev => [newConversation, ...prev]);
    return newConversation;
  };

  const addMessageToConversation = (
    conversationId: string, 
    message: Omit<Message, 'id' | 'timestamp'>
  ): void => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId) {
        const updatedConv = {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: message.role === 'assistant' ? message.content : conv.lastMessage,
          timestamp: new Date().toISOString()
        };
        return updatedConv;
      }
      return conv;
    }));
  };

  const updateConversationTitle = (conversationId: string, title: string): void => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, title }
        : conv
    ));
  };

  const deleteConversation = (conversationId: string): void => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
  };

  const clearAllConversations = (): void => {
    setConversations([]);
  };

  const refreshConversations = () => {
    loadConversations();
  };

  return {
    conversations,
    loading,
    getConversation,
    createConversation,
    addMessageToConversation,
    updateConversationTitle,
    deleteConversation,
    clearAllConversations,
    refreshConversations // New function to refresh when needed
  };
} 