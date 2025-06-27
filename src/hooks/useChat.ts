import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { apiFetch, buildApiUrl, api, QueryDocumentResponse } from '../lib/api';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { appReviewService } from '../services/appReviewService';
import { getMessageFingerprint, generateClientId } from '../utils/messageFingerprint';
import { ragFileService, ProcessingProgress } from '../services/ragFileService';
import { supabaseFileService } from '../services/supabaseFileService';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  session_id: string;
  created_at: string;
  function_calls?: any[];
  isStreaming?: boolean;
  // File attachment support
  type?: 'text' | 'file' | 'typing' | 'text_with_file';
  filename?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  documentId?: string;
  status?: 'uploading' | 'processing' | 'processed' | 'querying' | 'sent' | 'failed';
  metadata?: any;
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
  isSending: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string, sessionId?: string, useStreaming?: boolean, fileData?: any) => Promise<ChatResponse | null>;
  sendFileMessage: (file: any, userId: string, sessionId?: string) => Promise<void>;
  sendCombinedFileAndTextMessage: (file: any, text: string, userId: string, sessionId?: string, textMessageId?: string, fileMessageId?: string) => Promise<void>;
  createSession: (title?: string) => Promise<ChatSession | null>;
  loadSession: (sessionId: string, preserveCurrentMessages?: boolean) => Promise<void>;
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  setCurrentSession: (session: ChatSession | null) => void;
  queryFile: (fileId: string, filename: string, question: string, sessionId: string) => Promise<void>;
  // Message helpers
  appendMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
}

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCombinedFlow, setIsCombinedFlow] = useState(false); // Track combined flow state
  
  const lastUserMessageRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessages = useRef<Set<string>>(new Set()); // Track pending messages by fingerprint
  const tempAssistantIdRef = useRef<string | null>(null); // Track temp assistant message for immediate replacement

  // Helper functions for message state management
  const appendMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const updateMessage = (messageId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  };

  const removeMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  // Send message with idempotency protection
  const sendMessage = async (
    content: string, 
    sessionId?: string, 
    useStreaming: boolean = false
  ): Promise<ChatResponse | null> => {
    if (!content.trim()) return null;
    
    // 🔥 CRITICAL FIX: Use provided sessionId first, then fall back to currentSession
    // This allows proper new conversation creation
    let targetSessionId = sessionId || currentSession?.id;
    
    // Add guard to ensure we have a valid session context
    if (!targetSessionId) {
      // 🚀 CRITICAL: Create new session to ensure proper isolation
      console.log('🔧 Creating NEW session to ensure conversation isolation');
      const cleanTitle = content.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const sessionTitle = cleanTitle.length > 50 ? cleanTitle.substring(0, 50) + '...' : cleanTitle;
      
      try {
        const newSession = await apiFetch<ChatSession>('/sessions', {
          method: 'POST',
          body: JSON.stringify({
            title: sessionTitle
          })
        });
        
        if (newSession) {
          targetSessionId = newSession.id;
          setCurrentSession(newSession);
          setSessions(prev => [newSession, ...prev]);
          console.log('✅ NEW session created successfully:', targetSessionId);
          console.log('🔍 Session details:', { id: newSession.id, title: newSession.title });
        }
      } catch (sessionError) {
        console.error('❌ Session creation failed:', sessionError);
        throw new Error('Failed to create new session');
      }
    }

    // 🔧 Generate stable fingerprint and clientId for deduplication
    const messageFingerprint = getMessageFingerprint(content, targetSessionId || 'temp');
    
    // 🔧 Check if message is already pending (prevent double-tap)
    if (pendingMessages.current.has(messageFingerprint)) {
      console.log('🚫 Duplicate message blocked:', messageFingerprint);
      return null;
    }
    
    // 🔧 Add to pending messages and set sending state
    pendingMessages.current.add(messageFingerprint);
    setIsSending(true);
    setIsThinking(true); // Only set thinking, not loading
    setError(null);
    lastUserMessageRef.current = content;

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 🔧 Generate stable clientId for this message
    const clientId = generateClientId();
    
    try {
      console.log(`🎯 Sending message to session: ${targetSessionId} (fingerprint: ${messageFingerprint})`);
      
      // Add user message to UI immediately with stable clientId
      const userMessage: ChatMessage = {
        id: clientId, // Use clientId as optimistic ID
        content,
        role: 'user',
        session_id: targetSessionId || 'temp-session',
        created_at: new Date().toISOString()
      };
      
      // Add user message to UI (no duplicate check needed - fingerprint prevents this)
      setMessages(prev => [...prev, userMessage]);

      // Track message count for review system
      await appReviewService.incrementMessageCount();

      // Ensure targetSessionId is never undefined at this point
      if (!targetSessionId) {
        throw new Error('Session ID is required but missing');
      }

      if (useStreaming) {
        try {
          return await sendStreamingMessage(content, targetSessionId, userMessage);
        } catch (streamingError) {
          // Silently fall back to non-streaming for better UX
          console.log('🔄 Streaming failed, using non-streaming mode');
          // Remove the user message that was added for streaming
          setMessages(prev => prev.slice(0, -1));
          // Add it back and try non-streaming
          setMessages(prev => [...prev, userMessage]);
          return await sendRegularMessage(content, targetSessionId, userMessage);
        }
      } else {
        return await sendRegularMessage(content, targetSessionId, userMessage);
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
        return null;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('💥 Send message error:', errorMessage);
      setError(errorMessage);
      
      // 🔥 Better error handling for 401 authentication issues
      if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
        setError('Authentication failed. Please try refreshing the app.');
      }
      
      // Remove the user message on error
      setMessages(prev => prev.filter(msg => msg.id !== clientId));
      return null;
    } finally {
      // 🔧 Always cleanup pending state
      pendingMessages.current.delete(messageFingerprint);
      setIsSending(false);
      setIsStreaming(false);
      setIsThinking(false);
      // Note: Don't reset isLoading here as it's for conversation loading only
    }
  };

  // Regular message sending (non-streaming)
  const sendRegularMessage = async (
    content: string,
    targetSessionId: string,
    userMessage: ChatMessage
  ): Promise<ChatResponse | null> => {
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await apiFetch<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: content,
          sessionId: targetSessionId,
          actionType: 'general_chat',
          clientId: userMessage.id, // Pass clientId for deduplication
        }),
        signal: abortControllerRef.current.signal
      });

      // Add assistant message with proper ID from response
      const assistantMessage: ChatMessage = {
        id: response.id,
        content: response.message,
        role: 'assistant',
        session_id: targetSessionId || response.sessionId || 'unknown',
        created_at: response.timestamp,
        function_calls: []
      };
      
      // 🔧 FIX: Prevent duplicates - check if message already exists before adding
      setMessages(prev => {
        const existingMessage = prev.find(msg => msg.id === assistantMessage.id);
        if (existingMessage) {
          console.warn(`⚠️ [useChat] Duplicate assistant message detected, skipping: ${assistantMessage.id}`);
          return prev; // Don't add duplicate
        }
        return [...prev, assistantMessage];
      });

      // Track message count and session completion for review system
      await appReviewService.incrementMessageCount();
      await appReviewService.incrementSessionCount();

      // 🔧 FIX: Reload session to sync proper database IDs for all messages
      // Skip reload during combined flows to avoid wiping optimistic messages
      if (!isCombinedFlow) {
        console.log('🔄 [useChat] Reloading session to sync database IDs after sending message...');
        try {
          await loadSession(targetSessionId, true); // Preserve current messages during reload
          console.log('✅ [useChat] Session reloaded successfully with proper message IDs');
        } catch (reloadError) {
          console.warn('⚠️ [useChat] Session reload failed, but message was sent:', reloadError);
          // Don't throw - the message was sent successfully, ID sync is just nice-to-have
        }
      } else {
        console.log('🔄 [useChat] Skipping session reload during combined flow');
      }
      
      return response;
      
    } catch (chatError) {
      console.error('💥 Chat function error:', chatError);
      
      // 🔥 FALLBACK: If chat function fails, try a different approach
      if (chatError instanceof Error && (chatError.message.includes('401') || chatError.message.includes('Authentication'))) {
        console.log('🔄 Chat function 401 error, falling back to direct OpenAI integration');
        throw new Error('Chat service temporarily unavailable. Please try again or refresh the app.');
      }
      
      throw chatError;
    }
  };

  // Streaming message sending using fetch with ReadableStream
  const sendStreamingMessage = async (
    content: string,
    targetSessionId: string,
    userMessage: ChatMessage
  ): Promise<ChatResponse | null> => {
    setIsStreaming(true);

    // Add placeholder assistant message for streaming
    const streamingMessageId = `temp-assistant-${Date.now()}`;
    const streamingMessage: ChatMessage = {
      id: streamingMessageId,
      content: '',
      role: 'assistant',
      session_id: targetSessionId,
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, streamingMessage]);

    try {
      // Create abort controller for this specific request
      abortControllerRef.current = new AbortController();

      // Get authentication token (same as AI prompts service)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(buildApiUrl('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`, // ✅ Added missing auth header
        },
        body: JSON.stringify({
          message: content,
          sessionId: targetSessionId,
          actionType: 'general_chat',
          clientId: userMessage.id, // Pass clientId for deduplication
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      // Check if the response has a readable body
      if (!response.body) {
        // Chat function returned JSON instead of stream - this is expected fallback behavior
        throw new Error('Response body is not available for streaming');
      }

      // Verify response headers indicate streaming
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('text/plain') && !contentType.includes('text/event-stream')) {
        // Non-streaming response detected - will trigger fallback
        throw new Error('Non-streaming response detected');
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
                    
                    // 🎯 First real token received - stop thinking indicator and start streaming
                    setIsThinking(false);
                    setIsStreaming(true);
                    
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

                    // Track message completion and session for review system
                    await appReviewService.incrementMessageCount();
                    await appReviewService.incrementSessionCount();

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
        sessionId: finalSessionId || targetSessionId,
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
      const session = await apiFetch<ChatSession>('/sessions', {
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

  // Helper function to fetch and rehydrate file attachments for a session
  const rehydrateFileAttachments = async (sessionId: string): Promise<ChatMessage[]> => {
    try {
      console.log('📎 Rehydrating file attachments for session:', sessionId);
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Query for file upload messages and documents linked to this session
      const [messagesQuery, documentsQuery] = await Promise.all([
        // Look for file upload action messages 
        supabase
          .from('conversation_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .eq('action_type', 'file_upload')
          .order('created_at', { ascending: true }),
        
        // Look for documents that might be linked to this session
        supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .eq('session_id', sessionId) // Use session_id for better filtering
          .order('uploaded_at', { ascending: true })
      ]);

      const fileMessages = messagesQuery.data || [];
      const documents = documentsQuery.data || [];
      
      console.log(`📎 Found ${fileMessages.length} file messages and ${documents.length} session documents`);

      // Create file bubbles from file upload messages - but mark them for potential grouping
      const rehydratedMessages: ChatMessage[] = [];

      // Process file upload messages
      for (const msg of fileMessages) {
        const metadata = msg.metadata || {};
        
        // Find associated document if documentId is in metadata
        let associatedDoc = null;
        if (metadata.documentId) {
          associatedDoc = documents.find(doc => doc.id === metadata.documentId);
        }

        // Skip file messages that have textMessageId - they should be grouped with text messages
        if (metadata.textMessageId) {
          console.log(`📎 Skipping file message ${msg.id} - it's linked to text message ${metadata.textMessageId}`);
          continue;
        }

        // Create file bubble only for standalone file uploads (no associated text)
        const fileBubble: ChatMessage = {
          id: msg.id,
          content: associatedDoc ? `Document uploaded: ${associatedDoc.filename}` : 'File uploaded',
          role: 'user',
          session_id: sessionId,
          created_at: msg.created_at,
          type: 'file',
          filename: associatedDoc?.filename || metadata.filename || 'Unknown file',
          fileUrl: associatedDoc?.public_url || metadata.fileUrl,
          fileSize: associatedDoc?.file_size || metadata.fileSize,
          fileType: associatedDoc?.file_type || metadata.fileType,
          documentId: associatedDoc?.id || metadata.documentId,
          status: 'sent', // File uploads that are stored are considered successful
          metadata: {
            isStandaloneFile: true
          }
        };

        rehydratedMessages.push(fileBubble);
      }

      // Also check for any orphaned documents that might not have corresponding messages
      // (This handles edge cases where message creation failed but file upload succeeded)
      for (const doc of documents) {
        const hasCorrespondingMessage = rehydratedMessages.some(msg => 
          msg.documentId === doc.id
        );
        
        if (!hasCorrespondingMessage && doc.uploaded_at) {
          // Create a file bubble for orphaned document
          const orphanedFileBubble: ChatMessage = {
            id: `orphaned-${doc.id}`,
            content: `Document recovered: ${doc.filename}`,
            role: 'user', 
            session_id: sessionId,
            created_at: doc.uploaded_at,
            type: 'file',
            filename: doc.filename,
            fileUrl: doc.public_url,
            fileSize: doc.file_size,
            fileType: doc.file_type,
            documentId: doc.id,
            status: 'sent',
            metadata: {
              isOrphanedFile: true
            }
          };
          
          rehydratedMessages.push(orphanedFileBubble);
          console.log(`📎 Recovered orphaned document: ${doc.filename}`);
        }
      }

      console.log(`📎 Rehydrated ${rehydratedMessages.length} standalone file attachments`);
      return rehydratedMessages;

    } catch (error) {
      console.error('❌ Error rehydrating file attachments:', error);
      return [];
    }
  };

  // NEW: Enhanced message loading with file attachment grouping
  const loadMessagesWithAttachments = async (sessionId: string): Promise<ChatMessage[]> => {
    try {
      console.log('📎 Loading messages with file attachments for session:', sessionId);
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Load all conversation messages for the session
      const { data: allMessages, error: messagesError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        throw new Error(`Failed to load messages: ${messagesError.message}`);
      }

      // Load all user files for this session to get file metadata
      const { data: userFiles, error: filesError } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId);

      if (filesError) {
        console.warn('Failed to load user files:', filesError);
      }

      const sessionFiles = userFiles || [];
      console.log(`📎 Found ${allMessages?.length || 0} messages and ${sessionFiles.length} files`);

      // Process messages and enrich with file data
      const processedMessages: ChatMessage[] = [];

      for (const msg of allMessages || []) {
        // Create the base message
        const baseMessage: ChatMessage = {
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant',
          session_id: sessionId,
          created_at: msg.created_at || msg.message_timestamp,
          type: 'text',
          metadata: msg.metadata
        };

        // Check if this message has a file attachment
        if (msg.action_type === 'file_upload' && msg.metadata?.fileId) {
          const fileId = msg.metadata.fileId;
          const fileData = sessionFiles.find(f => f.id === fileId);
          
          if (fileData) {
            // This is a user message with file attachment
            baseMessage.type = 'text_with_file';
            baseMessage.filename = fileData.file_name;
            baseMessage.fileUrl = fileData.file_url;
            baseMessage.fileSize = fileData.file_size;
            baseMessage.fileType = fileData.file_type;
            baseMessage.status = 'sent';
            baseMessage.metadata = {
              ...baseMessage.metadata,
              hasAttachment: true,
              attachmentInfo: {
                filename: fileData.file_name,
                fileUrl: fileData.file_url,
                fileSize: fileData.file_size,
                fileType: fileData.file_type,
                fileId: fileData.id,
                status: 'sent'
              }
            };
            console.log(`📎 Enriched message ${msg.id} with file: ${fileData.file_name}`);
          }
        }

        processedMessages.push(baseMessage);
      }

      console.log(`✅ Processed ${processedMessages.length} messages with file enrichment`);
      return processedMessages;

    } catch (error) {
      console.error('❌ Error loading messages with attachments:', error);
      return [];
    }
  };

  // Load specific chat session
  const loadSession = async (sessionId: string, preserveCurrentMessages: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch session info and use enhanced message loading
      const [sessionResponse, enhancedMessages] = await Promise.all([
        apiFetch<{ session: ChatSession }>(`/sessions/${sessionId}`),
        loadMessagesWithAttachments(sessionId)
      ]);
      
      // 🔥 FIX: Always update currentSession to ensure proper session tracking
      setCurrentSession(sessionResponse.session);
      console.log(`🔄 Loaded session: ${sessionResponse.session.id} - "${sessionResponse.session.title}"`);
      console.log(`📊 Session has ${enhancedMessages.length} enhanced messages`);
      
      // 🔍 DEBUG: Check for duplicates in enhanced messages
      const messageIds = enhancedMessages.map(m => m.id);
      const uniqueIds = [...new Set(messageIds)];
      if (messageIds.length !== uniqueIds.length) {
        console.error('⚠️ [useChat] Duplicate messages detected in enhanced response!', {
          totalMessages: messageIds.length,
          uniqueMessages: uniqueIds.length,
          duplicateIds: messageIds.filter((id, index) => messageIds.indexOf(id) !== index)
        });
        // Remove duplicates
        const deduplicatedMessages = enhancedMessages.filter((msg, index, arr) => 
          arr.findIndex(m => m.id === msg.id) === index
        );
        console.log(`🔧 Removed duplicates: ${enhancedMessages.length} → ${deduplicatedMessages.length}`);
        enhancedMessages.splice(0, enhancedMessages.length, ...deduplicatedMessages);
      } else {
        console.log(`✅ [useChat] Enhanced message list clean: ${enhancedMessages.length} unique messages`);
      }
      
      if (!preserveCurrentMessages) {
        // Normal case: Replace all messages with enhanced messages
        console.log(`🔄 [useChat] Replacing ${messages.length} current messages with ${enhancedMessages.length} enhanced messages`);
        setMessages(enhancedMessages);
      } else {
        // When preserving messages (after sending), sync IDs with database
        setMessages(currentMessages => {
          if (currentMessages.length === 0) {
            return enhancedMessages;
          }
          
          // 🔧 FIX: Better duplicate prevention during ID sync
          const syncedMessages = currentMessages.map((currentMsg, index) => {
            // Find matching message in database by content and role
            const dbMatch = enhancedMessages.find(dbMsg => 
              dbMsg.role === currentMsg.role && 
              dbMsg.content.trim() === currentMsg.content.trim()
            );
            
            // Sync optimistic messages (either temp- prefixed or clientId-based)
            const isOptimisticMessage = currentMsg.id.startsWith('temp-') || 
              !enhancedMessages.find(db => db.id === currentMsg.id);
            
            if (dbMatch && isOptimisticMessage) {
              console.log(`🔄 [useChat] Syncing optimistic ID ${currentMsg.id} → ${dbMatch.id}`);
              return {
                ...currentMsg,
                id: dbMatch.id,
                session_id: dbMatch.session_id,
                created_at: dbMatch.created_at
              };
            }
            
            return currentMsg;
          });
          
          // 🔧 FIX: Remove any remaining duplicates after sync
          const uniqueSyncedMessages = syncedMessages.filter((msg, index, arr) => 
            arr.findIndex(m => m.id === msg.id) === index
          );
          
          if (uniqueSyncedMessages.length !== syncedMessages.length) {
            console.log(`🔧 [useChat] Removed ${syncedMessages.length - uniqueSyncedMessages.length} duplicates during sync`);
          }
          
          return uniqueSyncedMessages;
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
      const response = await apiFetch<{ sessions: ChatSession[] }>('/sessions');
      setSessions(response.sessions || []);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      console.warn('Failed to load sessions:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete chat session (using soft delete)
  const deleteSession = async (sessionId: string) => {
    console.log(`🗑️ useChat: Starting soft deletion for session ${sessionId}`);
    
    // Store whether this is the active session before deletion
    const isDeletingActiveSession = currentSession?.id === sessionId;
    
    setIsLoading(true);
    setError(null);

    try {
      // Call backend to soft delete session (30-day scheduled deletion)
      await apiFetch(`/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      console.log(`✅ useChat: Backend soft deletion successful for session: ${sessionId}`);

      // 🔥 REFRESH sessions from server to get updated list (no local filtering)
      console.log(`🔄 useChat: Refreshing sessions after soft deletion`);
      await loadSessions();
      
      // 🔥 Clear current session and messages if the deleted session was active
      if (isDeletingActiveSession) {
        setCurrentSession(null);
        setMessages([]);
        console.log('🔄 useChat: Cleared active session state after soft deletion');
      }

    } catch (err) {
      console.error(`❌ useChat: Soft delete session error for ${sessionId}:`, err);
      
      // Refresh sessions even on error to ensure UI is in sync
      console.log(`🔄 useChat: Refreshing sessions after delete error`);
      await loadSessions();
      
      // Don't show alert here if this is being called from instant delete
      // to avoid duplicate error handling
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      setError(errorMessage);
      
      // Re-throw so the calling code can handle the error appropriately
      throw err;
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
      const updatedSession = await apiFetch<ChatSession>(`/sessions/${sessionId}`, {
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

  // Clear current messages and session state
  const clearMessages = () => {
    console.log('🧹 Clearing messages and session state');
    setMessages([]);
    setCurrentSession(null); // 🔥 CRITICAL: Also clear current session
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

  // Send file message (ChatGPT-style file upload)
  const sendFileMessage = async (file: any, userId: string, sessionId?: string) => {
    let targetSessionId = currentSession?.id || sessionId;
    let newSession: ChatSession | null = null;
    
    if (!targetSessionId) {
      // Create a new session for file upload
      newSession = await createSession(`Document: ${file.name}`);
      if (!newSession) throw new Error('Failed to create session');
      targetSessionId = newSession.id;
    }

    // Generate client ID for optimistic message
    const clientId = generateClientId();

    // Create optimistic file message
    const fileMessage: ChatMessage = {
      id: clientId,
      content: '', // Empty content for file messages
      role: 'user',
      session_id: targetSessionId,
      created_at: new Date().toISOString(),
      type: 'file',
      filename: file.name,
      fileUrl: file.uri, // Temporary local URL
      fileSize: file.size,
      fileType: file.mimeType || file.type,
      status: 'uploading'
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, fileMessage]);

    try {
      // Upload and process document
      const ragDocument = await ragFileService.uploadAndProcessDocument(
        file,
        userId,
        (progress: ProcessingProgress) => {
          // Map progress stages to our status types
          let newStatus: ChatMessage['status'] = 'uploading';
          if (progress.stage === 'processing') newStatus = 'processing';
          else if (progress.stage === 'completed') newStatus = 'processed';
          else if (progress.stage === 'failed') newStatus = 'failed';
          
          // Update file message status during upload
          setMessages(prev => prev.map(msg => 
            msg.id === clientId ? { 
              ...msg, 
              content: `${progress.message}`,
              status: newStatus
            } : msg
          ));
        }
      );

      // 🔥 CRITICAL FIX: Create conversation_messages entry for standalone file upload
      console.log('📎 Creating conversation_messages entry for standalone file upload');
      const { data: fileUploadMessage, error: fileUploadError } = await supabase
        .from('conversation_messages')
        .insert({
          session_id: targetSessionId,
          user_id: userId,
          role: 'user',
          content: `File uploaded: ${ragDocument.filename}`,
          action_type: 'file_upload',
          metadata: {
            documentId: ragDocument.id,
            filename: ragDocument.filename,
            fileUrl: ragDocument.publicUrl,
            fileSize: ragDocument.fileSize,
            fileType: ragDocument.fileType,
            isStandaloneFile: true // Mark as standalone (not linked to text message)
          },
          created_at: new Date().toISOString(),
          message_timestamp: new Date().toISOString(),
          client_id: clientId
        })
        .select()
        .single();

      if (fileUploadError) {
        console.error('❌ Failed to create file upload message:', fileUploadError);
        // Don't throw - continue with the flow but log the issue
      } else {
        console.log(`✅ Created standalone file upload message: ${fileUploadMessage.id}`);
        
        // Update optimistic message with real database ID
        setMessages(prev => prev.map(msg => 
          msg.id === clientId ? { 
            ...msg, 
            id: fileUploadMessage.id,
            content: `Document uploaded successfully`,
            fileUrl: ragDocument.publicUrl || msg.fileUrl,
            documentId: ragDocument.id,
            status: 'sent'
          } : msg
        ));
      }

      // Generate AI acknowledgment using RAG query to ensure document access
      const acknowledgmentQuery = `Please analyze this uploaded document: ${file.name}. Provide a brief summary of its content and explain how you can help the user with this document.`;
      
      try {
        const ragResult = await ragFileService.queryDocuments(
          acknowledgmentQuery,
          targetSessionId,
          ragDocument.id,
          false // Don't include conversation context for acknowledgment
        );

        if (ragResult) {
          // Add the AI acknowledgment message to the chat
          const assistantMessage: ChatMessage = {
            id: ragResult.id,
            content: ragResult.answer,
            role: 'assistant',
            session_id: targetSessionId,
            created_at: new Date().toISOString(),
            type: 'text'
          };

          setMessages(prev => [...prev, assistantMessage]);
        }
      } catch (ragError) {
        console.error('RAG acknowledgment failed, falling back to regular message:', ragError);
        // Fallback to regular message if RAG fails
        const fallbackPrompt = `Document "${file.name}" has been uploaded and processed successfully. I can now analyze its content and answer questions about it.`;
        await sendMessage(fallbackPrompt, targetSessionId);
      }

    } catch (error) {
      // Update message with error status
      setMessages(prev => prev.map(msg => 
        msg.id === clientId ? { 
          ...msg, 
          content: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'failed'
        } : msg
      ));
      throw error;
    }
  };

  // Upload and process document (extracted helper function)
  const uploadAndProcessDocument = async (file: any, userId: string): Promise<{ documentId: string; publicUrl?: string }> => {
    return new Promise((resolve, reject) => {
      ragFileService.uploadAndProcessDocument(
        file,
        userId,
        (progress: ProcessingProgress) => {
          // Progress updates are handled by calling code
        }
      ).then((ragDocument) => {
        resolve({
          documentId: ragDocument.id,
          publicUrl: ragDocument.publicUrl
        });
      }).catch(reject);
    });
  };

  // Send combined file and text message (unified RAG flow)
  const sendCombinedFileAndTextMessage = async (
    file: any, 
    text: string, 
    userId: string, 
    sessionId?: string,
    textMessageId?: string,
    fileMessageId?: string
  ) => {
    console.log('🔥 Starting enhanced unified RAG flow');
    
    let targetSessionId = currentSession?.id || sessionId;
    
    if (!targetSessionId) {
      // Create a new session for combined upload
      const newSession = await createSession(`${text.substring(0, 30)}...`);
      if (!newSession) throw new Error('Failed to create session');
      targetSessionId = newSession.id;
    }

    // Use provided message IDs or generate fallback ones
    const fileClientId = fileMessageId || generateClientId();
    
    setIsCombinedFlow(true);
    setIsSending(true);
    setIsLoading(true);

    try {
      // 1. Upload & process file with progress updates
      const docMeta = await ragFileService.uploadAndProcessDocument(
        file,
        userId,
        (progress: ProcessingProgress) => {
          // Map progress stages to our status types
          let newStatus: ChatMessage['status'] = 'uploading';
          if (progress.stage === 'processing') newStatus = 'processing';
          else if (progress.stage === 'completed') newStatus = 'processed';
          else if (progress.stage === 'failed') newStatus = 'failed';
          
          // Update existing file message status
          updateMessage(fileClientId, {
            status: newStatus
          });
        }
      );

      // 2. Update document with session_id for proper linking
      console.log(`📎 Updating document ${docMeta.id} with session_id: ${targetSessionId}`);
      const { error: updateError } = await supabase
        .from('documents')
        .update({ session_id: targetSessionId })
        .eq('id', docMeta.id);

      if (updateError) {
        console.warn('Failed to update document session_id:', updateError);
      }

      // 3. Update file bubble to 'processed' status
      updateMessage(fileClientId, { 
        status: 'processed', 
        documentId: docMeta.id,
        fileUrl: docMeta.publicUrl 
      });

      // 4. Show assistant typing indicator
      const typingId = `typing-${Date.now()}`;
      tempAssistantIdRef.current = typingId; // Store temp ID for immediate replacement
      appendMessage({
        id: typingId,
        role: 'assistant',
        type: 'typing',
        content: '',
        session_id: targetSessionId,
        created_at: new Date().toISOString(),
      });
      setIsThinking(true);

      // 5. Use the existing query-document edge function (it now creates both user and assistant messages)
      console.log(`🤖 Calling query-document edge function`);
      const response = await api.queryDocument({
        documentId: docMeta.id,
        question: text,
        sessionId: targetSessionId,
        includeConversationContext: true
      });

      // 🔥 IMMEDIATE UI UPDATE: Replace temp spinner with real message as soon as response arrives
      if (tempAssistantIdRef.current) {
        console.log(`🔄 Immediately replacing temp message ${tempAssistantIdRef.current} with real response`);
        updateMessage(tempAssistantIdRef.current, {
          id: response.assistantMessageId || response.id,
          content: response.answer,
          type: 'text',
          metadata: {
            sources: response.sources,
            tokensUsed: response.tokensUsed,
            query_type: 'document'
          }
        });
        tempAssistantIdRef.current = null; // Clear the ref
        setIsThinking(false);
      }

      // 6. The edge function now creates messages automatically, so we need to find them
      // Wait a moment for the database to be consistent
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`🔍 Finding messages created by edge function`);
      // 🔥 FIX: Search by session and recent timestamp instead of content matching
      const searchTimestamp = new Date(Date.now() - 10000).toISOString(); // Last 10 seconds
      const { data: recentMessages, error: recentError } = await supabase
        .from('conversation_messages')
        .select('id, role, content, action_type, created_at')
        .eq('session_id', targetSessionId)
        .eq('user_id', userId)
        .gte('created_at', searchTimestamp)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        console.error('Failed to find messages:', recentError);
      }

      // Find the user text message (action_type = 'document_query') - most recent one
      const userTextMessage = recentMessages?.find(msg => 
        msg.role === 'user' && msg.action_type === 'document_query'
      );

      // 🔥 FIX: Use message IDs directly from response instead of searching
      const responseUserMessageId = response.userMessageId || userTextMessage?.id;
      
      if (responseUserMessageId) {
        console.log(`✅ Using user text message ID: ${responseUserMessageId}`);

        // 7. Create the file upload message linked to the text message
        console.log(`📎 Creating file upload message linked to text message: ${responseUserMessageId}`);
        const { data: fileUploadMessage, error: fileUploadError } = await supabase
          .from('conversation_messages')
          .insert({
            session_id: targetSessionId,
            user_id: userId,
            role: 'user',
            content: `File uploaded: ${docMeta.filename}`,
            action_type: 'file_upload',
            metadata: {
              documentId: docMeta.id,
              filename: docMeta.filename,
              fileUrl: docMeta.publicUrl,
              fileSize: docMeta.fileSize,
              fileType: docMeta.fileType,
              textMessageId: responseUserMessageId, // Link to the text message
              isLinkedToTextMessage: true
            },
            created_at: new Date().toISOString(),
            message_timestamp: new Date().toISOString(),
            client_id: generateClientId()
          })
          .select()
          .single();

        if (fileUploadError) {
          console.error('Failed to create file upload message:', fileUploadError);
          // Don't throw here - the main flow worked, this is just for UI linking
          console.warn('Continuing without file upload link message');
        } else {
          console.log(`✅ Created linked file upload message: ${fileUploadMessage.id}`);
        }
      } else {
        console.warn('⚠️ Could not find user text message, creating standalone file upload message');
        // Fallback: create standalone file upload message
        const { data: standaloneFileMessage, error: standaloneError } = await supabase
          .from('conversation_messages')
          .insert({
            session_id: targetSessionId,
            user_id: userId,
            role: 'user',
            content: `File uploaded: ${docMeta.filename}`,
            action_type: 'file_upload',
            metadata: {
              documentId: docMeta.id,
              filename: docMeta.filename,
              fileUrl: docMeta.publicUrl,
              fileSize: docMeta.fileSize,
              fileType: docMeta.fileType,
              isStandaloneFile: true
            },
            created_at: new Date().toISOString(),
            message_timestamp: new Date().toISOString(),
            client_id: generateClientId()
          })
          .select()
          .single();

        if (standaloneError) {
          console.error('Failed to create standalone file upload message:', standaloneError);
        } else {
          console.log(`✅ Created standalone file upload message: ${standaloneFileMessage.id}`);
        }
      }

      // 8. No need to remove typing indicator - already replaced with real message

      // 9. Reload session to get all messages with proper IDs (including ones created by edge function)
      console.log('🔄 Reloading session to sync all messages after RAG query');
      await loadSession(targetSessionId, true); // Preserve current optimistic messages

      console.log('✅ Enhanced unified RAG flow completed successfully');

    } catch (error) {
      console.error('❌ Enhanced unified RAG flow failed:', error);
      
      // Remove typing indicator if query failed and it wasn't replaced
      if (tempAssistantIdRef.current) {
        removeMessage(tempAssistantIdRef.current);
        tempAssistantIdRef.current = null;
      }
      
      // Update file message with error status
      updateMessage(fileClientId, {
        status: 'failed'
      });
      
      throw error;
    } finally {
      setIsCombinedFlow(false);
      setIsSending(false);
      setIsLoading(false);
      setIsThinking(false);
      tempAssistantIdRef.current = null; // Always clean up temp assistant ref
    }
  };

  // NEW: Query a processed file with a question
  const queryFile = async (
    fileId: string,
    filename: string,
    question: string,
    sessionId: string
  ) => {
    // Declare message IDs outside try block for error handling
    const userMessageId = `temp-user-${Date.now()}`;
    const assistantMessageId = `temp-assistant-${Date.now()}`;
    
    try {
      console.log(`🔍 Querying file ${fileId} with question: ${question}`);
      
      // Add optimistic user message
      const userMessage: ChatMessage = {
        id: userMessageId,
        content: question,
        role: 'user',
        session_id: sessionId,
        created_at: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => [...prev, userMessage]);

      // Add optimistic assistant typing message
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        session_id: sessionId,
        created_at: new Date().toISOString(),
        type: 'typing',
        isStreaming: true
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Call the query-file edge function
      const result = await supabaseFileService.queryFile(question, fileId, sessionId);
      
      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      // Replace optimistic messages with real ones from the database
      setMessages(prev => prev.filter(msg => 
        msg.id !== userMessageId && msg.id !== assistantMessageId
      ));

      // Add the real messages (they should already be in the database)
      await loadSession(sessionId, true);
      
      console.log(`✅ File query completed successfully`);
      
    } catch (error) {
      console.error('File query error:', error);
      
      // Update assistant message to show error
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId ? {
          ...msg,
          content: 'Sorry, I encountered an error while processing your question about this file. Please try again.',
          isStreaming: false,
          type: 'text'
        } : msg
      ));
      
      Alert.alert('Query Failed', 'Failed to process your question about the file. Please try again.');
    }
  };

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
    isSending,
    error,
    
    // Actions
    sendMessage,
    sendFileMessage,
    sendCombinedFileAndTextMessage,
    createSession,
    loadSession,
    loadSessions,
    deleteSession,
    renameSession,
    clearMessages,
    retryLastMessage,
    setCurrentSession,
    queryFile, // NEW: File query function
    // Message helpers
    appendMessage,
    updateMessage,
    removeMessage
  };
};