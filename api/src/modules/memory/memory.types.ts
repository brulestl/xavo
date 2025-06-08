export interface ConversationMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  actionType?: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  timestamp: Date;
  tokenCount?: number;
}

export interface ConversationSession {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  lastMessageAt: Date;
  createdAt: Date;
  messageCount: number;
  isActive: boolean;
}

export interface MemoryContext {
  recentMessages: ConversationMessage[];
  relevantHistory: ConversationMessage[];
  userProfile?: UserProfile;
  sessionSummary?: string;
}

export interface UserProfile {
  userId: string;
  preferences?: Record<string, any>;
  workContext?: {
    role?: string;
    company?: string;
    industry?: string;
    seniority?: string;
  };
  communicationStyle?: {
    formality?: 'formal' | 'casual' | 'mixed';
    directness?: 'direct' | 'diplomatic' | 'balanced';
    detail?: 'brief' | 'detailed' | 'comprehensive';
  };
  frequentTopics?: string[];
  lastUpdated: Date;
}

export interface SimilaritySearchRequest {
  query: string;
  userId: string;
  limit?: number;
  threshold?: number;
  sessionId?: string;
  excludeCurrentSession?: boolean;
}

export interface SimilaritySearchResult {
  message: ConversationMessage;
  similarity: number;
  relevanceScore: number;
}

export interface MemoryStorageOptions {
  maxRecentMessages?: number;
  maxRelevantHistory?: number;
  similarityThreshold?: number;
  includeSessions?: boolean;
  includeProfile?: boolean;
} 