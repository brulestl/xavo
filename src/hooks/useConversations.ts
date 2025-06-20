import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
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

interface ApiSession {
  id: string;
  title?: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
}

interface ApiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  message_timestamp: string;
}

export function useConversations() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load conversations from API
  const loadConversations = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      console.log('🔍 Loading conversations for user:', user.id);
      const response = await apiFetch<{ sessions: ApiSession[] }>('/chat/sessions');
      
      if (response?.sessions) {
        // Convert API sessions to local format
        const formattedConversations: Conversation[] = response.sessions.map(session => ({
          id: session.id,
          title: session.title || 'Untitled Conversation',
          preview: session.title || 'Conversation',
          lastMessage: '',
          timestamp: session.last_message_at || session.created_at,
          messages: [] // Messages will be loaded separately when needed
        }));

        // Sort by timestamp (most recent first)
        formattedConversations.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setConversations(formattedConversations);
        setHasLoaded(true);
        console.log(`✅ Loaded ${formattedConversations.length} conversations from API`);
      } else {
        console.warn('No sessions found in API response');
        setConversations([]);
        setHasLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load conversations from API:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  // Load messages for a specific conversation
  const loadConversationMessages = async (conversationId: string): Promise<Message[]> => {
    try {
      const response = await apiFetch<{
        session: ApiSession;
        messages: ApiMessage[];
      }>(`/chat/sessions/${conversationId}`);

      if (response?.messages) {
        return response.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.message_timestamp || msg.created_at
        }));
      }
      return [];
    } catch (error) {
      console.error(`Failed to load messages for conversation ${conversationId}:`, error);
      return [];
    }
  };

  // Load conversations when user changes (but only once auth is stable)
  useEffect(() => {
    if (!authLoading && user?.id && !hasLoaded) {
      console.log('🚀 useConversations: Loading conversations for user:', user.id);
      loadConversations();
    }
  }, [user?.id, authLoading, hasLoaded]);

  const getConversation = (id: string): Conversation | undefined => {
    return conversations.find(conv => conv.id === id);
  };

  const createConversation = (firstMessage: string): Conversation => {
    // This will be created by the API, so we just return a placeholder
    const newConversation: Conversation = {
      id: `temp_${Date.now()}`,
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
    }).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
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

  // 🔥 INSTANT RENAME with backend sync
  const renameConversationInstant = async (conversationId: string, newTitle: string): Promise<boolean> => {
    if (!newTitle.trim()) {
      throw new Error('Title cannot be empty');
    }

    // Store original title for rollback
    const originalConversation = conversations.find(conv => conv.id === conversationId);
    if (!originalConversation) {
      throw new Error('Conversation not found');
    }

    // 1. INSTANT UI update (optimistic)
    updateConversationTitle(conversationId, newTitle.trim());
    console.log(`✨ Instant rename: ${conversationId} to "${newTitle}"`);

    try {
      // 2. Sync with backend
      const response = await apiFetch(`/chat/sessions/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle.trim() })
      });

      console.log(`✅ Backend sync successful for rename: ${conversationId}`);
      return true;
    } catch (error) {
      console.error(`❌ Backend sync failed for rename: ${conversationId}`, error);
      
      // 3. Rollback on failure
      updateConversationTitle(conversationId, originalConversation.title);
      console.log(`🔄 Rolled back rename for: ${conversationId}`);
      
      throw error;
    }
  };

  // 🔥 INSTANT DELETE with backend sync
  const deleteConversationInstant = async (conversationId: string): Promise<boolean> => {
    console.log(`🚀 Frontend: Starting delete for conversation ${conversationId}`);
    
    // Store original conversation for rollback
    const originalConversation = conversations.find(conv => conv.id === conversationId);
    if (!originalConversation) {
      console.error(`❌ Frontend: Conversation ${conversationId} not found in local state`);
      throw new Error('Conversation not found');
    }

    console.log(`📋 Frontend: Found conversation to delete: "${originalConversation.title}"`);

    // 1. INSTANT UI update (optimistic)
    deleteConversation(conversationId);
    console.log(`✨ Frontend: Instant delete UI update completed for ${conversationId}`);

    try {
      // 2. Sync with backend
      console.log(`🔄 Frontend: Calling backend DELETE for ${conversationId}`);
      const response = await apiFetch(`/chat/sessions/${conversationId}`, {
        method: 'DELETE'
      });

      console.log(`✅ Frontend: Backend DELETE response:`, response);
      console.log(`✅ Backend sync successful for delete: ${conversationId}`);
      return true;
    } catch (error) {
      console.error(`❌ Frontend: Backend sync failed for delete: ${conversationId}`, error);
      console.error(`❌ Frontend: Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      // 3. Rollback on failure
      console.log(`🔄 Frontend: Rolling back delete for: ${conversationId}`);
      setConversations(prev => [originalConversation, ...prev].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
      console.log(`🔄 Rolled back delete for: ${conversationId}`);
      
      throw error;
    }
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
    loadConversationMessages, // New function to load messages
    createConversation,
    addMessageToConversation,
    updateConversationTitle,
    deleteConversation,
    clearAllConversations,
    refreshConversations,
    renameConversationInstant,
    deleteConversationInstant
  };
} 