import { useState, useEffect } from 'react';
import mockConversationsData from '../data/mockConversations.json';

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

// Type assertion for the imported JSON data
const mockConversations = mockConversationsData as Conversation[];

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [loading, setLoading] = useState(false);

  const getConversation = (id: string): Conversation | undefined => {
    return conversations.find(conv => conv.id === id);
  };

  const createConversation = (firstMessage: string): Conversation => {
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

  return {
    conversations,
    loading,
    getConversation,
    createConversation,
    addMessageToConversation,
    updateConversationTitle,
    deleteConversation,
    clearAllConversations
  };
} 