import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { apiFetch, buildApiUrl } from '../lib/api';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
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

interface ChatResponse {
  id: string;
  message: string;
  timestamp: string;
  sessionId: string;
  model: string;
  usage: {
    tokensUsed: number;
    remainingQueries?: number;
  };
}

interface UseChatReturn {
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string, sessionId?: string, useStreaming?: boolean) => Promise<ChatResponse | null>;
  createSession: (title?: string) => Promise<ChatSession | null>;
  loadSession: (sessionId: string, preserveCurrentMessages?: boolean) => Promise<void>;
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

  // Send message with optional streaming support (streaming enabled by default)
  const sendMessage = async (
    content: string, 
    sessionId?: string, 
    useStreaming: boolean = true
  ): Promise<ChatResponse | null> => {
    if (!content.trim()) return null;
    
    setIsLoading(true);
    setError(null);
    lastUserMessageRef.current = content;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      // Use current session or provided sessionId
      let targetSessionId = sessionId || currentSession?.id;

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        content,
        role: 'user',
        session_id: targetSessionId || 'temp',
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);

      if (useStreaming) {
        return await sendStreamingMessage(content, targetSessionId, userMessage);
      } else {
        return await sendRegularMessage(content, targetSessionId, userMessage);
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
        return null;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
      return null;
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  // Regular message sending (non-streaming)
  const sendRegularMessage = async (
    content: string,
    targetSessionId: string | undefined,
    userMessage: ChatMessage
  ): Promise<ChatResponse | null> => {
    abortControllerRef.current = new AbortController();
    
    const response = await apiFetch<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: content,
        sessionId: targetSessionId,
        actionType: 'general_chat',
      }),
      signal: abortControllerRef.current.signal
    });

    // Update session ID if this was a new conversation
    if (!targetSessionId && response.sessionId) {
      targetSessionId = response.sessionId;
      
      // Update the user message with correct session_id
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, session_id: targetSessionId! }
          : msg
      ));

      // Load the session details
      await loadSession(response.sessionId, true); // Preserve current messages
    }

    // Add assistant message
    const assistantMessage: ChatMessage = {
      id: response.id,
      content: response.message,
      role: 'assistant',
      session_id: targetSessionId || response.sessionId,
      created_at: response.timestamp,
      function_calls: []
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    return response;
  };

  // Streaming message sending using fetch with ReadableStream
  const sendStreamingMessage = async (
    content: string,
    targetSessionId: string | undefined,
    userMessage: ChatMessage
  ): Promise<ChatResponse | null> => {
    setIsStreaming(true);

    // Add placeholder assistant message for streaming
    const streamingMessageId = `temp-assistant-${Date.now()}`;
    const streamingMessage: ChatMessage = {
      id: streamingMessageId,
      content: '',
      role: 'assistant',
      session_id: targetSessionId || 'temp',
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, streamingMessage]);

    try {
      // Create abort controller for this specific request
      abortControllerRef.current = new AbortController();

      const response = await fetch(buildApiUrl('/chat/stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId: targetSessionId,
          actionType: 'general_chat',
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if the response has a readable body
      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      // Read the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let fullResponse = '';
      let finalSessionId = targetSessionId;
      let finalMessageId = streamingMessageId;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'session_created':
                    finalSessionId = data.sessionId;
                    // Update both user and streaming messages with real session ID
                    setMessages(prev => prev.map(msg => {
                      if (msg.id === userMessage.id || msg.id === streamingMessageId) {
                        return { ...msg, session_id: data.sessionId };
                      }
                      return msg;
                    }));
                    break;

                  case 'user_message_stored':
                    console.log('User message stored successfully');
                    break;

                  case 'stream_start':
                    console.log('Stream started');
                    break;

                  case 'token':
                    fullResponse += data.content;
                    // Update the streaming message content in real-time
                    setMessages(prev => prev.map(msg => 
                      msg.id === streamingMessageId 
                        ? { ...msg, content: fullResponse }
                        : msg
                    ));
                    break;

                  case 'stream_complete':
                    finalMessageId = data.messageId;
                    finalSessionId = data.sessionId;
                    
                    // Mark message as complete and update with final data
                    setMessages(prev => prev.map(msg => 
                      msg.id === streamingMessageId 
                        ? { 
                            ...msg, 
                            id: data.messageId,
                            content: data.fullMessage || fullResponse,
                            isStreaming: false,
                            created_at: new Date().toISOString()
                          }
                        : msg
                    ));

                    // Load session details if this was a new session
                    if (data.sessionId && !currentSession) {
                      loadSession(data.sessionId, true); // Preserve current messages
                    }

                    return {
                      id: data.messageId,
                      message: data.fullMessage || fullResponse,
                      timestamp: new Date().toISOString(),
                      sessionId: data.sessionId,
                      model: 'gpt-4o-mini',
                      usage: {
                        tokensUsed: Math.ceil((data.fullMessage || fullResponse).length / 4),
                        remainingQueries: 999
                      }
                    };

                  case 'error':
                    throw new Error(data.message);
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete chunks
                console.warn('Parse error (ignored):', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // If we reach here without returning, create a fallback response
      return {
        id: finalMessageId,
        message: fullResponse,
        timestamp: new Date().toISOString(),
        sessionId: finalSessionId || 'unknown',
        model: 'gpt-4o-mini',
        usage: {
          tokensUsed: Math.ceil(fullResponse.length / 4),
          remainingQueries: 999
        }
      };

    } catch (err) {
      // Remove the streaming message on error
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
      throw err;
    }
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
      setMessages([]); // Clear messages for new session
      
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
  const loadSession = async (sessionId: string, preserveCurrentMessages: boolean = false) => {
    console.log(`🔄 loadSession called: sessionId=${sessionId}, preserveCurrentMessages=${preserveCurrentMessages}`);
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        session: ChatSession;
        messages: ChatMessage[];
      }>(`/chat/sessions/${sessionId}`);
      
      setCurrentSession(data.session);
      console.log(`📥 Session data received: ${(data.messages || []).length} messages from server`);
      
      // Only update messages if we're not preserving current ones
      if (!preserveCurrentMessages) {
        console.log('🔄 NOT preserving messages, setting to server messages');
        setMessages(data.messages || []);
      } else {
        // When preserving messages, check current state using callback
        console.log('🔒 Preserving current messages, checking state...');
        setMessages(currentMessages => {
          console.log(`🔒 Current messages count: ${currentMessages.length}, Server messages count: ${(data.messages || []).length}`);
          // If we have current messages, keep them; otherwise use server messages
          const result = currentMessages.length > 0 ? currentMessages : (data.messages || []);
          console.log(`🔒 Decision: ${currentMessages.length > 0 ? 'KEEPING current messages' : 'USING server messages'}`);
          return result;
        });
      }

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
      const response = await apiFetch<{ sessions: ChatSession[] }>('/chat/sessions');
      setSessions(response.sessions || []);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      console.warn('Failed to load sessions:', errorMessage);
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