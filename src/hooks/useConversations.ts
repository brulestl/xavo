import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';

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

export function useConversations() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);



  // Load conversations directly from Supabase (PRIMARY METHOD)
  const loadConversations = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      console.log('🚀 Loading conversations directly from Supabase for user:', user.id);
      
      const { data: sessions, error } = await supabase
        .from('active_conversation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase query error:', error);
        throw error;
      }

      if (sessions) {
        const formattedConversations: Conversation[] = sessions.map(session => ({
          id: session.id,
          title: session.title || 'Untitled Conversation',
          preview: session.title || 'Conversation',
          lastMessage: '',
          timestamp: session.last_message_at || session.created_at,
          messages: []
        }));

        setConversations(formattedConversations);
        setHasLoaded(true);
        console.log(`✅ Loaded ${formattedConversations.length} conversations from Supabase`);
      } else {
        console.log('📭 No conversations found');
        setConversations([]);
        setHasLoaded(true);
      }
    } catch (error) {
      console.error('❌ Failed to load conversations from Supabase:', error);
      setConversations([]);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Load messages for a specific conversation from Supabase
  const loadConversationMessages = async (conversationId: string): Promise<Message[]> => {
    try {
      console.log(`🔍 Loading messages for conversation: ${conversationId}`);
      
      const { data: messages, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', conversationId)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ Supabase error loading messages for ${conversationId}:`, error);
        throw error;
      }

      if (messages) {
        const formattedMessages: Message[] = messages.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.message_timestamp || msg.created_at
        }));

        console.log(`✅ Loaded ${formattedMessages.length} messages for conversation ${conversationId}`);
        return formattedMessages;
      }
      
      return [];
    } catch (error) {
      console.error(`❌ Failed to load messages for conversation ${conversationId}:`, error);
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

  const createConversation = async (firstMessage: string): Promise<Conversation> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('🆕 Creating new conversation in Supabase...');
      
      // Create session in Supabase
      const { data: session, error: sessionError } = await supabase
        .from('conversation_sessions')
        .insert({
          user_id: user.id,
          title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : ''),
          last_message_at: new Date().toISOString(),
          is_active: true,
          message_count: 1
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create first message in Supabase
      const { data: message, error: messageError } = await supabase
        .from('conversation_messages')
        .insert({
          session_id: session.id,
          user_id: user.id,
          role: 'user',
          content: firstMessage,
          created_at: new Date().toISOString(),
          message_timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (messageError) throw messageError;

      const newConversation: Conversation = {
        id: session.id,
        title: session.title,
        preview: firstMessage,
        lastMessage: '',
        timestamp: session.last_message_at,
        messages: [
          {
            id: message.id,
            role: 'user',
            content: firstMessage,
            timestamp: message.message_timestamp
          }
        ]
      };

      // Add to local state
      setConversations(prev => [newConversation, ...prev]);
      console.log(`✅ Created new conversation: ${session.id}`);
      
      return newConversation;
    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      throw error;
    }
  };

  const addMessageToConversation = async (
    conversationId: string, 
    message: Omit<Message, 'id' | 'timestamp'>
  ): Promise<Message> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      console.log(`💬 Adding message to conversation ${conversationId}`);
      
      const timestamp = new Date().toISOString();
      
      // Insert message into Supabase
      const { data: newMessage, error } = await supabase
        .from('conversation_messages')
        .insert({
          session_id: conversationId,
          user_id: user.id,
          role: message.role,
          content: message.content,
          created_at: timestamp,
          message_timestamp: timestamp
        })
        .select()
        .single();

      if (error) throw error;

      const formattedMessage: Message = {
        id: newMessage.id,
        role: message.role,
        content: message.content,
        timestamp: newMessage.message_timestamp
      };

          // Update local state and re-sort by timestamp
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id === conversationId) {
            const updatedConv = {
              ...conv,
              messages: [...conv.messages, formattedMessage],
              lastMessage: message.role === 'assistant' ? message.content : conv.lastMessage,
              timestamp: timestamp
            };
            return updatedConv;
          }
          return conv;
        });
        
        // Sort by timestamp descending (most recent first)
        return updated.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });

      console.log(`✅ Message added to conversation ${conversationId}`);
      return formattedMessage;
    } catch (error) {
      console.error(`❌ Failed to add message to conversation ${conversationId}:`, error);
      throw error;
    }
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
      // 2. Sync with Supabase
      const { error } = await supabase
        .from('conversation_sessions')
        .update({ title: newTitle.trim() })
        .eq('id', conversationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log(`✅ Supabase sync successful for rename: ${conversationId}`);
      return true;
    } catch (error) {
      console.error(`❌ Supabase sync failed for rename: ${conversationId}`, error);
      
      // 3. Rollback on failure
      updateConversationTitle(conversationId, originalConversation.title);
      console.log(`🔄 Rolled back rename for: ${conversationId}`);
      
      throw error;
    }
  };

  // 🔥 INSTANT DELETE with backend sync
  const deleteConversationInstant = async (conversationId: string): Promise<boolean> => {
    console.log(`🚀 Frontend: Starting delete for conversation ${conversationId}`);
    
    try {
      // 1. Call backend soft delete FIRST (no optimistic UI update)
      console.log(`🔄 Frontend: Calling soft delete for ${conversationId}`);
      const { data, error } = await supabase
        .rpc('soft_delete_session', { 
          p_session_id: conversationId, 
          p_user_id: user?.id 
        });

      if (error) throw error;
      
      if (!data) {
        throw new Error('Session not found or already deleted');
      }

      console.log(`✅ Frontend: Session soft deleted successfully: ${conversationId}`);
      
      // 2. Force refresh conversations from database to get updated list
      console.log(`🔄 Frontend: Refreshing conversations after soft delete`);
      await loadConversations();
      
      console.log(`✨ Frontend: Delete completed for ${conversationId}`);
      return true;
    } catch (error) {
      console.error(`❌ Frontend: Failed to delete conversation: ${conversationId}`, error);
      
      // Don't rollback since we didn't do optimistic updates
      // Just refresh to make sure UI is in sync
      console.log(`🔄 Frontend: Refreshing conversations after delete error`);
      await loadConversations();
      
      throw error;
    }
  };

  const clearAllConversations = (): void => {
    setConversations([]);
  };

  const refreshConversations = () => {
    console.log('🔄 [useConversations] Manual refresh triggered');
    loadConversations();
  };

  // Trigger conversation refresh when a conversation gets a new message
  const triggerRefreshAfterMessage = (conversationId: string) => {
    console.log(`🔄 [useConversations] Refreshing after message in conversation: ${conversationId}`);
    // Delay refresh slightly to allow database trigger to complete
    setTimeout(() => {
      loadConversations();
    }, 500);
  };

  // Update a specific message in the database
  const updateMessage = async (sessionId: string, messageId: string, newContent: string): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      console.log(`📝 Updating message ${messageId} in session ${sessionId}`);
      
      const { error } = await supabase
        .from('conversation_messages')
        .update({ 
          content: newContent.trim()
          // Note: Only updating content - updated_at column doesn't exist in current schema
        })
        .eq('id', messageId)
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log(`✅ Message ${messageId} updated successfully`);
    } catch (error) {
      console.error(`❌ Failed to update message ${messageId}:`, error);
      throw error;
    }
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
    triggerRefreshAfterMessage, // NEW: Trigger refresh after message
    renameConversationInstant,
    deleteConversationInstant,
    updateMessage
  };
} 