import { useState, useEffect } from 'react';
import { Alert } from 'react-native';

export interface Memory {
  id: string;
  memory_content: string;
  memory_type: 'insight' | 'goal' | 'preference' | 'experience' | 'skill' | 'challenge';
  importance_score: number;
  tags: string[];
  created_at: string;
  similarity_score?: number;
}

export interface MemorySearchResult {
  memories: Memory[];
  total_count: number;
  search_query: string;
  search_time_ms: number;
}

interface UseMemoryReturn {
  memories: Memory[];
  searchResults: MemorySearchResult | null;
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  
  // Actions
  searchMemories: (query: string, limit?: number) => Promise<void>;
  loadAllMemories: () => Promise<void>;
  addMemory: (content: string, type: Memory['memory_type'], importance: number, tags?: string[]) => Promise<boolean>;
  updateMemory: (id: string, updates: Partial<Memory>) => Promise<boolean>;
  deleteMemory: (id: string) => Promise<boolean>;
  clearSearch: () => void;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useMemory = (): UseMemoryReturn => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchResults, setSearchResults] = useState<MemorySearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search memories with query
  const searchMemories = async (query: string, limit: number = 10) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams({
        q: query.trim(),
        limit: limit.toString()
      });

      const response = await fetch(
        `${API_BASE_URL}/api/v1/memory/search?${searchParams}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // TODO: Add authentication header
            // 'Authorization': `Bearer ${userToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      const searchResult: MemorySearchResult = {
        memories: result.memories || [],
        total_count: result.total_count || 0,
        search_query: query,
        search_time_ms: result.search_time_ms || 0
      };

      setSearchResults(searchResult);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      Alert.alert('Search Error', errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  // Load all memories
  const loadAllMemories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/memory`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
          // 'Authorization': `Bearer ${userToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load memories: ${response.statusText}`);
      }

      const data = await response.json();
      setMemories(data.memories || []);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load memories';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new memory
  const addMemory = async (
    content: string, 
    type: Memory['memory_type'], 
    importance: number, 
    tags: string[] = []
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
          // 'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          memory_content: content,
          memory_type: type,
          importance_score: importance,
          tags
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add memory: ${response.statusText}`);
      }

      const newMemory = await response.json();
      
      // Add to local state
      setMemories(prev => [newMemory, ...prev]);
      
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add memory';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Update existing memory
  const updateMemory = async (id: string, updates: Partial<Memory>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/memory/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
          // 'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update memory: ${response.statusText}`);
      }

      const updatedMemory = await response.json();
      
      // Update local state
      setMemories(prev => prev.map(memory => 
        memory.id === id ? { ...memory, ...updatedMemory } : memory
      ));
      
      // Update search results if they exist
      if (searchResults) {
        setSearchResults(prev => prev ? {
          ...prev,
          memories: prev.memories.map(memory => 
            memory.id === id ? { ...memory, ...updatedMemory } : memory
          )
        } : null);
      }
      
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update memory';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete memory
  const deleteMemory = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/memory/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add authentication header
          // 'Authorization': `Bearer ${userToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.statusText}`);
      }

      // Remove from local state
      setMemories(prev => prev.filter(memory => memory.id !== id));
      
      // Remove from search results if they exist
      if (searchResults) {
        setSearchResults(prev => prev ? {
          ...prev,
          memories: prev.memories.filter(memory => memory.id !== id),
          total_count: prev.total_count - 1
        } : null);
      }
      
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete memory';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Clear search results
  const clearSearch = () => {
    setSearchResults(null);
  };

  // Load memories on mount
  useEffect(() => {
    loadAllMemories();
  }, []);

  return {
    memories,
    searchResults,
    isLoading,
    isSearching,
    error,
    
    // Actions
    searchMemories,
    loadAllMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    clearSearch
  };
}; 