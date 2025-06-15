import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { apiFetch, buildApiUrl } from '../src/lib/api';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  session_id: string;
  created_at: string;
  function_calls?: any[];
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  last_message_at?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string, sessionId?: string) => Promise<void>;
  createSession: (title?: string) => Promise<ChatSession | null>;
  loadSession: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const lastUserMessageRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Send message with streaming support
  const sendMessage = async (content: string, sessionId?: string) => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    lastUserMessageRef.current = content;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Use current session or create new one
      let targetSessionId = sessionId || currentSession?.id;
      
      if (!targetSessionId) {
        const newSession = await createSession();
        if (!newSession) {
          throw new Error('Failed to create chat session');
        }
        targetSessionId = newSession.id;
      }

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        role: 'user',
        session_id: targetSessionId,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);

      // Add placeholder for streaming assistant message
      const assistantMessageId = `temp-assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        session_id: targetSessionId,
        created_at: new Date().toISOString(),
        isStreaming: true
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // Check if we should use Server-Sent Events or WebSocket
      const useSSE = true; // Default to SSE for simplicity
      
      if (useSSE) {
        await handleSSEStream(content, targetSessionId, assistantMessageId);
      } else {
        await handleWebSocketStream(content, targetSessionId, assistantMessageId);
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      
      // Remove the streaming message on error
      setMessages(prev => prev.filter(msg => !msg.isStreaming));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Handle Server-Sent Events streaming
  const handleSSEStream = async (content: string, sessionId: string, messageId: string) => {
    const response = await fetch(buildApiUrl('/chat/message/stream'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        // TODO: Add authentication header
        // 'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        content,
        session_id: sessionId
      }),
      signal: abortControllerRef.current?.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Stream complete
              setMessages(prev => prev.map(msg => 
                msg.id === messageId 
                  ? { ...msg, isStreaming: false }
                  : msg
              ));
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.content) {
                // Update message content
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId 
                    ? { ...msg, content: msg.content + parsed.content }
                    : msg
                ));
              }
              
              if (parsed.function_calls) {
                // Handle function calls
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId 
                    ? { ...msg, function_calls: parsed.function_calls }
                    : msg
                ));
              }
              
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  // Handle WebSocket streaming (alternative implementation)
  const handleWebSocketStream = async (content: string, sessionId: string, messageId: string) => {
    // For now, fall back to regular POST request
    // TODO: Implement WebSocket streaming if needed
    const response = await fetch(buildApiUrl('/chat/message'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add authentication header
        // 'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        content,
        session_id: sessionId
      }),
      signal: abortControllerRef.current?.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Update the streaming message with the complete response
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            id: result.id,
            content: result.content,
            function_calls: result.function_calls,
            isStreaming: false 
          }
        : msg
    ));
  };

  // Create new chat session
  const createSession = async (title?: string): Promise<ChatSession | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await apiFetch<ChatSession>('/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: title || `Chat ${new Date().toLocaleDateString()}`
        })
      });

      setCurrentSession(session);
      setSessions(prev => [session, ...prev]);
      
      return session;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Load specific chat session
  const loadSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        session: ChatSession;
        messages: ChatMessage[];
      }>(`/chat/sessions/${sessionId}`);
      
      setCurrentSession(data.session);
      setMessages(data.messages || []);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Load all chat sessions
  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionsData = await apiFetch<ChatSession[]>('/chat/sessions');
      setSessions(sessionsData || []);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete chat session
  const deleteSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiFetch(`/chat/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      // Remove from local state
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // Clear current session if it was deleted
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear current messages
  const clearMessages = () => {
    setMessages([]);
  };

  // Retry last message
  const retryLastMessage = async () => {
    if (lastUserMessageRef.current && currentSession) {
      // Remove the last assistant message if it exists and failed
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant' && (lastMessage.isStreaming || !lastMessage.content)) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      
      await sendMessage(lastUserMessageRef.current, currentSession.id);
    }
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    sessions,
    currentSession,
    isLoading,
    isStreaming,
    error,
    
    // Actions
    sendMessage,
    createSession,
    loadSession,
    loadSessions,
    deleteSession,
    clearMessages,
    retryLastMessage
  };
}; 