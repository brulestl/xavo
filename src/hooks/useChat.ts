import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { apiFetch, buildApiUrl } from '../lib/api';
import { useAuth } from '../providers/AuthProvider';

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
  isThinking: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string, sessionId?: string, useStreaming?: boolean) => Promise<ChatResponse | null>;
  createSession: (title?: string) => Promise<ChatSession | null>;
  loadSession: (sessionId: string, preserveCurrentMessages?: boolean) => Promise<void>;
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
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
    setIsThinking(true);
    setError(null);
    lastUserMessageRef.current = content;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      // 🔥 FIX: Prioritize currentSession?.id over provided sessionId to ensure 
      // messages go to the currently selected session, not route parameter
      let targetSessionId = currentSession?.id || sessionId;
      
      // Add guard to ensure we have a valid session context
      if (!targetSessionId) {
        // If no session is available, create a new one with the message content as title
        const cleanTitle = content.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
        const sessionTitle = cleanTitle.length > 50 ? cleanTitle.substring(0, 50) + '...' : cleanTitle;
        const newSession = await createSession(sessionTitle);
        if (!newSession) {
          throw new Error('Failed to create new session');
        }
        targetSessionId = newSession.id;
      }

      console.log(`🎯 Sending message to session: ${targetSessionId} (current: ${currentSession?.id}, provided: ${sessionId})`);

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        content,
        role: 'user',
        session_id: targetSessionId,
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
      setIsThinking(false);
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

      // 🎯 Enhanced streaming: Buffer for paragraph-based display
      let tokenBuffer = '';
      let displayedContent = '';
      const updateInterval = 150; // ms between updates
      let lastUpdateTime = 0;

      // Helper function to update display content in chunks
      const updateDisplayContent = (forceUpdate = false) => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime;
        
        if (!forceUpdate && timeSinceLastUpdate < updateInterval) {
          return; // Too soon for next update
        }

        // Look for good breaking points for paragraph-like streaming
        const breakPoints = [
          '\n\n',  // Paragraph breaks
          '. ',    // Sentence endings
          '? ',    // Question endings  
          '! ',    // Exclamation endings
          ': ',    // Colon (often leads to examples/lists)
          '; '     // Semicolon
        ];

        let updateContent = displayedContent;
        let foundBreakPoint = false;

        // Find the furthest break point we can display
        for (const breakPoint of breakPoints) {
          const breakIndex = tokenBuffer.lastIndexOf(breakPoint);
          if (breakIndex > displayedContent.length - tokenBuffer.indexOf(displayedContent)) {
            const newContent = tokenBuffer.substring(0, breakIndex + breakPoint.length);
            if (newContent.length > displayedContent.length) {
              updateContent = newContent;
              foundBreakPoint = true;
              break;
            }
          }
        }

        // If no break point found, gradually show more content
        if (!foundBreakPoint && tokenBuffer.length > displayedContent.length + 10) {
          // Show content in 10-15 character chunks
          const chunkSize = Math.min(15, tokenBuffer.length - displayedContent.length);
          updateContent = tokenBuffer.substring(0, displayedContent.length + chunkSize);
        }

        // Update UI if we have new content to show
        if (updateContent.length > displayedContent.length || forceUpdate) {
          const previousLength = displayedContent.length;
          displayedContent = updateContent;
          lastUpdateTime = now;
          
          // 🎯 Add slight delay for paragraph breaks for better readability
          const isNewParagraph = updateContent.includes('\n\n') && 
                                updateContent.lastIndexOf('\n\n') >= previousLength;
          
          const updateUI = () => {
            setMessages(prev => prev.map(msg => {
              if (msg.id === streamingMessageId) {
                return { ...msg, content: displayedContent };
              }
              return msg;
            }));
          };
          
          if (isNewParagraph && !forceUpdate) {
            // Small delay for paragraph breaks (makes it more readable)
            setTimeout(updateUI, 250);
          } else {
            updateUI();
          }
        }
      };

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
                    // User message stored in database
                    break;

                  case 'stream_start':
                    // Streaming started - reset buffer for clean start
                    tokenBuffer = '';
                    displayedContent = '';
                    lastUpdateTime = 0;
                    break;

                  case 'token':
                    // 🔥 Filter out loading/interim messages
                    if (!data.content || data.content === '[loading…]') break;
                    
                    // 🎯 First real token received - stop thinking indicator
                    setIsThinking(false);
                    
                    // 🎯 Add to buffer and update display intelligently
                    tokenBuffer += data.content;
                    fullResponse += data.content;
                    
                    // Update display using paragraph-based logic
                    updateDisplayContent();
                    break;

                  case 'stream_complete':
                    finalMessageId = data.messageId;
                    finalSessionId = data.sessionId;
                    
                    // 🎯 Force final update to show complete content
                    tokenBuffer = data.fullMessage || fullResponse;
                    updateDisplayContent(true); // Force final update
                    
                    // 🔥 Mark message as complete
                    setMessages(prev => prev.map(msg => {
                      if (msg.id === streamingMessageId) {
                        return { 
                            ...msg, 
                            id: data.messageId,
                            content: data.fullMessage || fullResponse,
                            isStreaming: false,
                            created_at: new Date().toISOString()
                        };
                          }
                      return msg;
                    }));

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
                // Ignore parse errors for incomplete JSON chunks during streaming
                continue;
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
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        session: ChatSession;
        messages: ChatMessage[];
      }>(`/chat/sessions/${sessionId}`);
      
      // 🔥 FIX: Always update currentSession to ensure proper session tracking
      setCurrentSession(data.session);
      console.log(`🔄 Loaded session: ${data.session.id} - "${data.session.title}"`);
      
      // Clear messages first, then load new ones (unless preserving for streaming)
      if (!preserveCurrentMessages) {
        setMessages(data.messages || []);
      } else {
        // When preserving messages (during streaming), only update if we don't have current messages
        setMessages(currentMessages => {
          return currentMessages.length > 0 ? currentMessages : (data.messages || []);
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      console.error('Load session error:', err);
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
      // Call backend to delete session and all its messages
      await apiFetch(`/chat/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      console.log(`🗑️ Deleted session: ${sessionId}`);

      // Remove from local state
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // 🔥 FIX: Clear current session and messages if the deleted session was active
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
        console.log('🔄 Cleared active session state after deletion');
      }

      // Refresh sessions list to ensure consistency
      await loadSessions();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      console.error('Delete session error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Rename chat session
  const renameSession = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Session title cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call backend to update session title
      const updatedSession = await apiFetch<ChatSession>(`/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle.trim() })
      });

      console.log(`✏️ Renamed session: ${sessionId} to "${newTitle}"`);

      // Update local state
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, title: updatedSession.title }
            : session
        )
      );

      // Update current session if it's the one being renamed
      if (currentSession?.id === sessionId) {
        setCurrentSession(prev => prev ? { ...prev, title: updatedSession.title } : null);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename session';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      console.error('Rename session error:', err);
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

  // Load sessions on mount (only after auth is stable)
  const { loading: authLoading } = useAuth();
  const [hasLoadedSessions, setHasLoadedSessions] = useState(false);

  useEffect(() => {
    if (!authLoading && !hasLoadedSessions) {
      console.log('🚀 useChat: Loading sessions after auth stabilized');
      loadSessions().then(() => setHasLoadedSessions(true));
    }
  }, [authLoading, hasLoadedSessions]);

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
    isThinking,
    error,
    
    // Actions
    sendMessage,
    createSession,
    loadSession,
    loadSessions,
    deleteSession,
    renameSession,
    clearMessages,
    retryLastMessage
  };
};