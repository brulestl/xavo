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
  isProcessingFile: boolean;
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
  // File processing helpers
  setFileProcessingState: (isProcessing: boolean) => void;
}

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCombinedFlow, setIsCombinedFlow] = useState(false);
  
  const lastUserMessageRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessages = useRef<Set<string>>(new Set());
  const tempAssistantIdRef = useRef<string | null>(null);

  const appendMessage = (message: ChatMessage) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === message.id);
      if (idx >= 0) {
        const copy = [...prev];
        // Ensure session_id is preserved during upsert
        copy[idx] = { ...copy[idx], ...message, session_id: message.session_id || copy[idx].session_id };
        return copy;
      }
      // Ensure new messages have session_id
      const messageWithSession = { ...message, session_id: message.session_id || currentSession?.id || 'temp-session' };
      return [...prev, messageWithSession];
    });
  };

  const updateMessage = (messageId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  };

  const removeMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const sendMessage = async (
    content: string, 
    sessionId?: string, 
    useStreaming: boolean = false
  ): Promise<ChatResponse | null> => {
    if (!content.trim()) return null;
    
    let targetSessionId = sessionId || currentSession?.id;
    
    if (!targetSessionId) {
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

    const messageFingerprint = getMessageFingerprint(content, targetSessionId || 'temp');
    
    if (pendingMessages.current.has(messageFingerprint)) {
      console.log('🚫 Duplicate message blocked:', messageFingerprint);
      return null;
    }
    
    pendingMessages.current.add(messageFingerprint);
    setIsSending(true);
    setIsThinking(true);
    setError(null);
    lastUserMessageRef.current = content;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const clientId = generateClientId();
    
    try {
      console.log(`🎯 Sending message to session: ${targetSessionId} (fingerprint: ${messageFingerprint})`);
      
      const userMessage: ChatMessage = {
        id: clientId,
        content,
        role: 'user',
        session_id: targetSessionId || 'temp-session',
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === userMessage.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...userMessage };
          return copy;
        }
        return [...prev, userMessage];
      });

      await appReviewService.incrementMessageCount();

      if (!targetSessionId) {
        throw new Error('Session ID is required but missing');
      }

      if (useStreaming) {
        try {
          return await sendStreamingMessage(content, targetSessionId, userMessage);
        } catch (streamingError) {
          console.log('🔄 Streaming failed, using non-streaming mode');
          setMessages(prev => prev.slice(0, -1));
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === userMessage.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...userMessage };
              return copy;
            }
            return [...prev, userMessage];
          });
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
      
      if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
        setError('Authentication failed. Please try refreshing the app.');
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== clientId));
      return null;
    } finally {
      pendingMessages.current.delete(messageFingerprint);
      setIsSending(false);
      setIsStreaming(false);
      setIsThinking(false);
    }
  };

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
          clientId: userMessage.id,
        }),
        signal: abortControllerRef.current.signal
      });

      const assistantMessage: ChatMessage = {
        id: response.id,
        content: response.message,
        role: 'assistant',
        session_id: targetSessionId || response.sessionId || 'unknown',
        created_at: response.timestamp,
        function_calls: []
      };
      
      setMessages(prev => {
        const existingMessage = prev.find(msg => msg.id === assistantMessage.id);
        if (existingMessage) {
          console.warn(`⚠️ [useChat] Duplicate assistant message detected, skipping: ${assistantMessage.id}`);
          return prev;
        }
        return [...prev, assistantMessage];
      });

      await appReviewService.incrementMessageCount();
      await appReviewService.incrementSessionCount();

      if (!isCombinedFlow) {
        console.log('🔄 [useChat] Reloading session to sync database IDs after sending message...');
        try {
          await loadSession(targetSessionId, true);
          console.log('✅ [useChat] Session reloaded successfully with proper message IDs');
        } catch (reloadError) {
          console.warn('⚠️ [useChat] Session reload failed, but message was sent:', reloadError);
        }
      } else {
        console.log('🔄 [useChat] Skipping session reload during combined flow');
      }
      
      return response;
      
    } catch (chatError) {
      console.error('💥 Chat function error:', chatError);
      
      if (chatError instanceof Error && (chatError.message.includes('401') || chatError.message.includes('Authentication'))) {
        console.log('🔄 Chat function 401 error, falling back to direct OpenAI integration');
        throw new Error('Chat service temporarily unavailable. Please try again or refresh the app.');
      }
      
      throw chatError;
    }
  };

  const sendStreamingMessage = async (
    content: string,
    targetSessionId: string,
    userMessage: ChatMessage
  ): Promise<ChatResponse | null> => {
    setIsStreaming(true);

    const streamingMessageId = `temp-assistant-${Date.now()}`;
    const streamingMessage: ChatMessage = {
      id: streamingMessageId,
      content: '',
      role: 'assistant',
      session_id: targetSessionId,
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === streamingMessage.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...streamingMessage };
        return copy;
      }
      return [...prev, streamingMessage];
    });

    try {
      abortControllerRef.current = new AbortController();

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(buildApiUrl('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: content,
          sessionId: targetSessionId,
          actionType: 'general_chat',
          clientId: userMessage.id,
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('text/plain') && !contentType.includes('text/event-stream')) {
        throw new Error('Non-streaming response detected');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let fullResponse = '';
      let finalSessionId = targetSessionId;
      let finalMessageId = streamingMessageId;

      let tokenBuffer = '';
      let displayedContent = '';
      const updateInterval = 150;
      let lastUpdateTime = 0;

      const updateDisplayContent = (forceUpdate = false) => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime;
        
        if (!forceUpdate && timeSinceLastUpdate < updateInterval) {
          return;
        }

        const breakPoints = [
          '\n\n',
          '. ',
          '? ',
          '! ',
          ': ',
          '; '
        ];

        let updateContent = displayedContent;
        let foundBreakPoint = false;

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

        if (!foundBreakPoint && tokenBuffer.length > displayedContent.length + 10) {
          const chunkSize = Math.min(15, tokenBuffer.length - displayedContent.length);
          updateContent = tokenBuffer.substring(0, displayedContent.length + chunkSize);
        }

        if (updateContent.length > displayedContent.length || forceUpdate) {
          const previousLength = displayedContent.length;
          displayedContent = updateContent;
          lastUpdateTime = now;
          
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
                    setMessages(prev => prev.map(msg => {
                      if (msg.id === userMessage.id || msg.id === streamingMessageId) {
                        return { ...msg, session_id: data.sessionId };
                      }
                      return msg;
                    }));
                    break;

                  case 'user_message_stored':
                    break;

                  case 'stream_start':
                    tokenBuffer = '';
                    displayedContent = '';
                    lastUpdateTime = 0;
                    break;

                  case 'token':
                    if (!data.content || data.content === '[loading…]') break;
                    
                    setIsThinking(false);
                    setIsStreaming(true);
                    
                    tokenBuffer += data.content;
                    fullResponse += data.content;
                    
                    updateDisplayContent();
                    break;

                  case 'stream_complete':
                    finalMessageId = data.messageId;
                    finalSessionId = data.sessionId;
                    
                    tokenBuffer = data.fullMessage || fullResponse;
                    updateDisplayContent(true);
                    
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

                    if (data.sessionId && !currentSession) {
                      loadSession(data.sessionId, true);
                    }

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
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

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
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
      throw err;
    }
  };

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
      setMessages([]);
      
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

  const rehydrateFileAttachments = async (sessionId: string): Promise<ChatMessage[]> => {
    try {
      console.log('📎 Rehydrating file attachments for session:', sessionId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const [messagesQuery, documentsQuery] = await Promise.all([
        supabase
          .from('conversation_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .eq('action_type', 'file_upload')
          .order('created_at', { ascending: true }),
        
        supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .order('uploaded_at', { ascending: true })
      ]);

      const fileMessages = messagesQuery.data || [];
      const documents = documentsQuery.data || [];
      
      console.log(`📎 Found ${fileMessages.length} file messages and ${documents.length} session documents`);

      const rehydratedMessages: ChatMessage[] = [];

      for (const msg of fileMessages) {
        const metadata = msg.metadata || {};
        
        let associatedDoc = null;
        if (metadata.documentId) {
          associatedDoc = documents.find(doc => doc.id === metadata.documentId);
        }

        if (metadata.textMessageId) {
          console.log(`📎 Skipping file message ${msg.id} - it's linked to text message ${metadata.textMessageId}`);
          continue;
        }

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
          status: 'sent',
          metadata: {
            isStandaloneFile: true
          }
        };

        rehydratedMessages.push(fileBubble);
      }

      for (const doc of documents) {
        const hasCorrespondingMessage = rehydratedMessages.some(msg => 
          msg.documentId === doc.id
        );
        
        if (!hasCorrespondingMessage && doc.uploaded_at) {
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

  const loadMessagesWithAttachments = async (sessionId: string): Promise<ChatMessage[]> => {
    try {
      console.log('📎 Loading messages with file attachments for session:', sessionId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: allMessages, error: messagesError } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        throw new Error(`Failed to load messages: ${messagesError.message}`);
      }

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

      const processedMessages: ChatMessage[] = [];

      for (const msg of allMessages || []) {
        const baseMessage: ChatMessage = {
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant',
          session_id: sessionId,
          created_at: msg.created_at || msg.message_timestamp,
          type: 'text',
          metadata: msg.metadata
        };

        if (msg.action_type === 'file_upload' && msg.metadata?.fileId) {
          const fileId = msg.metadata.fileId;
          const fileData = sessionFiles.find(f => f.id === fileId);
          
          if (fileData) {
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

  const loadSession = async (sessionId: string, preserveCurrentMessages: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const [sessionResponse, enhancedMessages] = await Promise.all([
        apiFetch<{ session: ChatSession }>(`/sessions/${sessionId}`),
        loadMessagesWithAttachments(sessionId)
      ]);
      
      setCurrentSession(sessionResponse.session);
      console.log(`🔄 Loaded session: ${sessionResponse.session.id} - "${sessionResponse.session.title}"`);
      console.log(`📊 Session has ${enhancedMessages.length} enhanced messages`);
      
      const messageIds = enhancedMessages.map(m => m.id);
      const uniqueIds = [...new Set(messageIds)];
      if (messageIds.length !== uniqueIds.length) {
        console.error('⚠️ [useChat] Duplicate messages detected in enhanced response!', {
          totalMessages: messageIds.length,
          uniqueMessages: uniqueIds.length,
          duplicateIds: messageIds.filter((id, index) => messageIds.indexOf(id) !== index)
        });
        const deduplicatedMessages = enhancedMessages.filter((msg, index, arr) => 
          arr.findIndex(m => m.id === msg.id) === index
        );
        console.log(`🔧 Removed duplicates: ${enhancedMessages.length} → ${deduplicatedMessages.length}`);
        enhancedMessages.splice(0, enhancedMessages.length, ...deduplicatedMessages);
      } else {
        console.log(`✅ [useChat] Enhanced message list clean: ${enhancedMessages.length} unique messages`);
      }
      
      if (!preserveCurrentMessages) {
        console.log(`🔄 [useChat] Replacing ${messages.length} current messages with ${enhancedMessages.length} enhanced messages`);
        setMessages(enhancedMessages);
      } else {
        setMessages(currentMessages => {
          if (currentMessages.length === 0) {
            return enhancedMessages;
          }
          
          // 🔧 CRITICAL: Defer syncing until session exists
          if (!sessionId) {
            console.log('⏸️ [useChat] Deferring optimistic ID sync until session exists');
            return currentMessages;
          }
          
          const syncedMessages = currentMessages.map((currentMsg, index) => {
            const dbMatch = enhancedMessages.find(dbMsg => 
              dbMsg.role === currentMsg.role && 
              dbMsg.content.trim() === currentMsg.content.trim()
            );
            
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

  const deleteSession = async (sessionId: string) => {
    console.log(`🗑️ useChat: Starting soft deletion for session ${sessionId}`);
    
    const isDeletingActiveSession = currentSession?.id === sessionId;
    
    setIsLoading(true);
    setError(null);

    try {
      await apiFetch(`/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      console.log(`✅ useChat: Backend soft deletion successful for session: ${sessionId}`);

      console.log(`🔄 useChat: Refreshing sessions after soft deletion`);
      await loadSessions();
      
      if (isDeletingActiveSession) {
        setCurrentSession(null);
        setMessages([]);
        console.log('🔄 useChat: Cleared active session state after soft deletion');
      }

    } catch (err) {
      console.error(`❌ useChat: Soft delete session error for ${sessionId}:`, err);
      
      console.log(`🔄 useChat: Refreshing sessions after delete error`);
      await loadSessions();
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      setError(errorMessage);
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const renameSession = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Session title cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedSession = await apiFetch<ChatSession>(`/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle.trim() })
      });

      console.log(`✏️ Renamed session: ${sessionId} to "${newTitle}"`);

      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, title: updatedSession.title }
            : session
        )
      );

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

  const clearMessages = () => {
    console.log('🧹 Clearing messages and session state');
    setMessages([]);
    setCurrentSession(null);
  };

  const retryLastMessage = async () => {
    if (lastUserMessageRef.current && currentSession) {
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

  const { loading: authLoading } = useAuth();
  const [hasLoadedSessions, setHasLoadedSessions] = useState(false);

  useEffect(() => {
    if (!authLoading && !hasLoadedSessions) {
      console.log('🚀 useChat: Loading sessions after auth stabilized');
      loadSessions().then(() => setHasLoadedSessions(true));
    }
  }, [authLoading, hasLoadedSessions]);

  const sendFileMessage = async (file: any, userId: string, sessionId?: string) => {
    let targetSessionId = currentSession?.id || sessionId;
    let newSession: ChatSession | null = null;
    
    if (!targetSessionId) {
      newSession = await createSession(`Document: ${file.name}`);
      if (!newSession) throw new Error('Failed to create session');
      targetSessionId = newSession.id;
    }

    const clientId = generateClientId();

    const fileMessage: ChatMessage = {
      id: clientId,
      content: '',
      role: 'user',
      session_id: targetSessionId,
      created_at: new Date().toISOString(),
      type: 'file',
      filename: file.name,
      fileUrl: file.uri,
      fileSize: file.size,
      fileType: file.mimeType || file.type,
      status: 'uploading'
    };

    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === fileMessage.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...fileMessage };
        return copy;
      }
      return [...prev, fileMessage];
    });

    try {
      const ragDocument = await ragFileService.uploadAndProcessDocument(
        file,
        userId,
        (progress: ProcessingProgress) => {
          let newStatus: ChatMessage['status'] = 'uploading';
          if (progress.stage === 'processing') newStatus = 'processing';
          else if (progress.stage === 'completed') newStatus = 'processed';
          else if (progress.stage === 'failed') newStatus = 'failed';
          
          setMessages(prev => prev.map(msg => 
            msg.id === clientId ? { 
              ...msg, 
              content: `${progress.message}`,
              status: newStatus
            } : msg
          ));
        }
      );

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
            isStandaloneFile: true
          },
          created_at: new Date().toISOString(),
          message_timestamp: new Date().toISOString(),
          client_id: clientId
        })
        .select()
        .single();

      if (fileUploadError) {
        console.error('❌ Failed to create file upload message:', fileUploadError);
      } else {
        console.log(`✅ Created standalone file upload message: ${fileUploadMessage.id}`);
        
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

      const acknowledgmentQuery = `Please analyze this uploaded document: ${file.name}. Provide a brief summary of its content and explain how you can help the user with this document.`;
      
      try {
        const ragResult = await ragFileService.queryDocuments(
          acknowledgmentQuery,
          targetSessionId,
          ragDocument.id,
          false
        );

        if (ragResult) {
          const assistantMessage: ChatMessage = {
            id: ragResult.id,
            content: ragResult.answer,
            role: 'assistant',
            session_id: targetSessionId,
            created_at: new Date().toISOString(),
            type: 'text'
          };

          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === assistantMessage.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...assistantMessage };
              return copy;
            }
            return [...prev, assistantMessage];
          });
        }
      } catch (ragError) {
        console.error('RAG acknowledgment failed, falling back to regular message:', ragError);
        const fallbackPrompt = `Document "${file.name}" has been uploaded and processed successfully. I can now analyze its content and answer questions about it.`;
        await sendMessage(fallbackPrompt, targetSessionId);
      }

    } catch (error) {
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
      const newSession = await createSession(`${text.substring(0, 30)}...`);
      if (!newSession) throw new Error('Failed to create session');
      targetSessionId = newSession.id;
    }

    const fileClientId = fileMessageId || generateClientId();
    
    setIsCombinedFlow(true);
    setIsSending(true);
    setIsLoading(true);

    try {
      const docMeta = await ragFileService.uploadAndProcessDocument(
        file,
        userId,
        (progress: ProcessingProgress) => {
          let newStatus: ChatMessage['status'] = 'uploading';
          if (progress.stage === 'processing') newStatus = 'processing';
          else if (progress.stage === 'completed') newStatus = 'processed';
          else if (progress.stage === 'failed') newStatus = 'failed';
          
          updateMessage(fileClientId, {
            status: newStatus
          });
        }
      );

      console.log(`📎 Updating document ${docMeta.id} with session_id: ${targetSessionId}`);
      const { error: updateError } = await supabase
        .from('documents')
        .update({ session_id: targetSessionId })
        .eq('id', docMeta.id);

      if (updateError) {
        console.warn('Failed to update document session_id:', updateError);
      }

      updateMessage(fileClientId, { 
        status: 'processed', 
        documentId: docMeta.id,
        fileUrl: docMeta.publicUrl 
      });

      const typingId = `typing-${Date.now()}`;
      tempAssistantIdRef.current = typingId;
      appendMessage({
        id: typingId,
        role: 'assistant',
        type: 'typing',
        content: '',
        session_id: targetSessionId,
        created_at: new Date().toISOString(),
      });
      setIsThinking(true);

      const response = await api.queryDocument({
        documentId: docMeta.id,
        question: text,
        sessionId: targetSessionId,
        includeConversationContext: true
      });

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
        tempAssistantIdRef.current = null;
        setIsThinking(false);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`🔍 Finding messages created by edge function`);
      const searchTimestamp = new Date(Date.now() - 10000).toISOString();
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

      const userTextMessage = recentMessages?.find(msg => 
        msg.role === 'user' && msg.action_type === 'document_query'
      );

      const responseUserMessageId = response.userMessageId || userTextMessage?.id;
      
      if (responseUserMessageId) {
        console.log(`✅ Using user text message ID: ${responseUserMessageId}`);

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
              textMessageId: responseUserMessageId,
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
          console.warn('Continuing without file upload link message');
        } else {
          console.log(`✅ Created linked file upload message: ${fileUploadMessage.id}`);
        }
      } else {
        console.warn('⚠️ Could not find user text message, creating standalone file upload message');
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
      console.log('✅ Enhanced unified RAG flow completed successfully');

    } catch (error) {
      console.error('❌ Enhanced unified RAG flow failed:', error);
      
      if (tempAssistantIdRef.current) {
        removeMessage(tempAssistantIdRef.current);
        tempAssistantIdRef.current = null;
      }
      
      updateMessage(fileClientId, {
        status: 'failed'
      });
      
      throw error;
    } finally {
      setIsCombinedFlow(false);
      setIsSending(false);
      setIsLoading(false);
      setIsThinking(false);
      tempAssistantIdRef.current = null;
    }
  };

  const queryFile = async (
    fileId: string,
    filename: string,
    question: string,
    sessionId: string
  ) => {
    const userMessageId = `temp-user-${Date.now()}`;
    const assistantMessageId = `temp-assistant-${Date.now()}`;
    
    try {
      console.log(`🔍 Querying file ${fileId} with question: ${question}`);
      
      const userMessage: ChatMessage = {
        id: userMessageId,
        content: question,
        role: 'user',
        session_id: sessionId,
        created_at: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === userMessage.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...userMessage };
          return copy;
        }
        return [...prev, userMessage];
      });

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        session_id: sessionId,
        created_at: new Date().toISOString(),
        type: 'typing',
        isStreaming: true
      };
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === assistantMessage.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...assistantMessage };
          return copy;
        }
        return [...prev, assistantMessage];
      });

      const result = await supabaseFileService.queryFile(question, fileId, sessionId);
      
      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      setMessages(prev => prev.filter(msg => 
        msg.id !== userMessageId && msg.id !== assistantMessageId
      ));

      await loadSession(sessionId, true);
      
      console.log(`✅ File query completed successfully`);
      
    } catch (error) {
      console.error('File query error:', error);
      
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

  const setFileProcessingState = (isProcessing: boolean) => {
    setIsProcessingFile(isProcessing);
    setIsCombinedFlow(isProcessing);
  };

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
    isProcessingFile,
    error,
    
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
    queryFile,
    appendMessage,
    updateMessage,
    removeMessage,
    setFileProcessingState
  };
};