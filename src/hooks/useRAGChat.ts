import { useState, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { ragFileService, QueryResult, RAGDocument } from '../services/ragFileService';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  actionType?: string;
  metadata?: any;
  sources?: Array<{
    documentId: string;
    filename: string;
    page: number;
    chunkIndex: number;
    similarity: number;
    content: string;
  }>;
  tokensUsed?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  isActive: boolean;
}

interface UseRAGChatReturn {
  // Chat state
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  
  // Document state
  userDocuments: RAGDocument[];
  documentsLoading: boolean;
  activeDocumentId: string | null;
  
  // Actions
  sendMessage: (content: string, isDocumentQuery?: boolean) => Promise<void>;
  sendDocumentQuery: (question: string, documentId?: string) => Promise<QueryResult | null>;
  createNewSession: (title?: string) => Promise<ChatSession | null>;
  loadSession: (sessionId: string) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<ChatMessage[]>;
  setActiveDocument: (documentId: string | null) => void;
  refreshDocuments: () => Promise<void>;
  clearError: () => void;
}

export const useRAGChat = (): UseRAGChatReturn => {
  const { user } = useAuth();
  
  // Chat state
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Document state
  const [userDocuments, setUserDocuments] = useState<RAGDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load user documents
  const refreshDocuments = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setDocumentsLoading(true);
      const documents = await ragFileService.getUserDocuments(user.id);
      setUserDocuments(documents);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
    } finally {
      setDocumentsLoading(false);
    }
  }, [user?.id]);

  // Set active document for queries
  const setActiveDocument = useCallback((documentId: string | null) => {
    setActiveDocumentId(documentId);
  }, []);

  // Create new chat session
  const createNewSession = useCallback(async (title?: string): Promise<ChatSession | null> => {
    if (!user?.id) {
      setError('Authentication required');
      return null;
    }

    try {
      setIsLoading(true);
      
      const { data: session, error: sessionError } = await supabase
        .from('conversation_sessions')
        .insert({
          user_id: user.id,
          title: title || 'New Conversation',
          last_message_at: new Date().toISOString(),
          is_active: true,
          message_count: 0
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const newSession: ChatSession = {
        id: session.id,
        title: session.title,
        lastMessageAt: session.last_message_at,
        messageCount: session.message_count,
        isActive: session.is_active
      };

      setCurrentSession(newSession);
      setMessages([]);
      return newSession;
      
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Failed to create new conversation');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load existing session
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      
      // Load session details
      const { data: session, error: sessionError } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      setCurrentSession({
        id: session.id,
        title: session.title,
        lastMessageAt: session.last_message_at,
        messageCount: session.message_count,
        isActive: session.is_active
      });

      // Load messages
      await loadMessages(sessionId);
      
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load messages for a session
  const loadMessages = useCallback(async (sessionId: string): Promise<ChatMessage[]> => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const formattedMessages: ChatMessage[] = messagesData.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.created_at,
        actionType: msg.action_type,
        metadata: msg.metadata,
        sources: msg.metadata?.sources_used || undefined,
        tokensUsed: msg.raw_response?.usage?.total_tokens || undefined
      }));

      setMessages(formattedMessages);
      return formattedMessages;
      
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages');
      return [];
    }
  }, []);

  // Send regular chat message
  const sendMessage = useCallback(async (content: string, isDocumentQuery: boolean = false) => {
    if (!user?.id || !currentSession) {
      setError('Session required');
      return;
    }

    try {
      setIsLoading(true);
      
      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        role: 'user',
        timestamp: new Date().toISOString(),
        actionType: isDocumentQuery ? 'document_query' : 'chat'
      };
      
      setMessages(prev => [...prev, userMessage]);

      if (isDocumentQuery && activeDocumentId) {
        // Handle document query
        const result = await sendDocumentQuery(content, activeDocumentId);
        if (result) {
                     const assistantMessage: ChatMessage = {
             id: result.id,
             content: result.answer,
             role: 'assistant',
             timestamp: new Date().toISOString(),
             actionType: 'document_response',
             sources: result.sources,
             tokensUsed: result.tokensUsed
           };
          
          setMessages(prev => prev.slice(0, -1).concat([
            { ...userMessage, id: `user-${Date.now()}` },
            assistantMessage
          ]));
        }
      } else {
        // Handle regular chat
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error('Authentication required');

        const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wdhmlynmbrhunizbdhdt.supabase.co'}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            message: content,
            sessionId: currentSession.id
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as any).error || 'Chat request failed');
        }

        const result = await response.json();
        
        const assistantMessage: ChatMessage = {
          id: result.id,
          content: result.message,
          role: 'assistant',
          timestamp: result.timestamp,
          tokensUsed: result.usage?.tokensUsed
        };

        setMessages(prev => prev.slice(0, -1).concat([
          { ...userMessage, id: `user-${Date.now()}` },
          assistantMessage
        ]));
      }
      
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
      // Remove the temporary user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentSession, activeDocumentId]);

  // Send document query
  const sendDocumentQuery = useCallback(async (question: string, documentId?: string): Promise<QueryResult | null> => {
    if (!user?.id) {
      setError('Authentication required');
      return null;
    }

    try {
      const result = await ragFileService.queryDocuments(
        question,
        currentSession?.id,
        documentId || activeDocumentId || undefined,
        true // Include conversation context
      );

      return result;
      
    } catch (err) {
      console.error('Document query failed:', err);
      setError('Failed to query documents');
      return null;
    }
  }, [user?.id, currentSession?.id, activeDocumentId]);

  return {
    // Chat state
    currentSession,
    messages,
    isLoading,
    error,
    
    // Document state
    userDocuments,
    documentsLoading,
    activeDocumentId,
    
    // Actions
    sendMessage,
    sendDocumentQuery,
    createNewSession,
    loadSession,
    loadMessages,
    setActiveDocument,
    refreshDocuments,
    clearError
  };
}; 