import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useMemory, Memory } from '../hooks/useMemory';

// Skeleton loader for search results
const SearchSkeleton: React.FC = () => (
  <View style={styles.skeletonContainer}>
    {[1, 2, 3, 4, 5].map((index) => (
      <View key={index} style={styles.skeletonItem}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonType} />
          <View style={styles.skeletonScore} />
        </View>
        <View style={styles.skeletonContent} />
        <View style={[styles.skeletonContent, { width: '70%' }]} />
        <View style={styles.skeletonTags}>
          <View style={styles.skeletonTag} />
          <View style={styles.skeletonTag} />
        </View>
      </View>
    ))}
  </View>
);

// Memory item component
const MemoryItem: React.FC<{ 
  memory: Memory; 
  onPress: (memory: Memory) => void;
}> = ({ memory, onPress }) => {
  const getTypeColor = (type: Memory['memory_type']) => {
    const colors = {
      insight: '#28a745',
      goal: '#007bff',
      preference: '#6f42c1',
      experience: '#fd7e14',
      skill: '#20c997',
      challenge: '#dc3545',
    };
    return colors[type] || '#6c757d';
  };

  const getImportanceLabel = (score: number) => {
    if (score >= 8) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  };

  return (
    <TouchableOpacity style={styles.memoryItem} onPress={() => onPress(memory)}>
      <View style={styles.memoryHeader}>
        <View style={[
          styles.memoryType, 
          { backgroundColor: getTypeColor(memory.memory_type) }
        ]}>
          <Text style={styles.memoryTypeText}>
            {memory.memory_type.charAt(0).toUpperCase() + memory.memory_type.slice(1)}
          </Text>
        </View>
        
        <View style={styles.memoryMeta}>
          <Text style={styles.importanceText}>
            {getImportanceLabel(memory.importance_score)} Priority
          </Text>
          {memory.similarity_score && (
            <Text style={styles.similarityText}>
              {Math.round(memory.similarity_score * 100)}% match
            </Text>
          )}
        </View>
      </View>
      
      <Text style={styles.memoryContent} numberOfLines={3}>
        {memory.memory_content}
      </Text>
      
      {memory.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {memory.tags.slice(0, 3).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {memory.tags.length > 3 && (
            <Text style={styles.moreTagsText}>+{memory.tags.length - 3} more</Text>
          )}
        </View>
      )}
      
      <Text style={styles.memoryDate}>
        {new Date(memory.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
};

// Memory detail modal
const MemoryDetailModal: React.FC<{
  memory: Memory | null;
  visible: boolean;
  onClose: () => void;
}> = ({ memory, visible, onClose }) => {
  if (!memory) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Memory Details</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalContent}>
          <View style={styles.memoryDetailHeader}>
            <Text style={styles.memoryDetailType}>
              {memory.memory_type.charAt(0).toUpperCase() + memory.memory_type.slice(1)}
            </Text>
            <Text style={styles.memoryDetailScore}>
              Importance: {memory.importance_score}/10
            </Text>
          </View>
          
          <Text style={styles.memoryDetailContent}>
            {memory.memory_content}
          </Text>
          
          {memory.tags.length > 0 && (
            <View style={styles.memoryDetailTags}>
              <Text style={styles.tagsLabel}>Tags:</Text>
              <View style={styles.tagsContainer}>
                {memory.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          <Text style={styles.memoryDetailDate}>
            Created: {new Date(memory.created_at).toLocaleString()}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

interface InsightsDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export const InsightsDrawer: React.FC<InsightsDrawerProps> = ({ visible, onClose }) => {
  const {
    memories,
    searchResults,
    isLoading,
    isSearching,
    error,
    searchMemories,
    clearSearch,
  } = useMemory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchMemories(searchQuery.trim());
    } else {
      clearSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    clearSearch();
  };

  const handleMemoryPress = (memory: Memory) => {
    setSelectedMemory(memory);
    setShowDetailModal(true);
  };

  const displayMemories = searchResults ? searchResults.memories : memories.slice(0, 20);

  const renderMemory = ({ item }: { item: Memory }) => (
    <MemoryItem memory={item} onPress={handleMemoryPress} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>
        {searchQuery ? 'No memories found' : 'No insights yet'}
      </Text>
      <Text style={styles.emptyStateText}>
        {searchQuery 
          ? 'Try adjusting your search terms or browse all memories.'
          : 'Your insights and memories will appear here as you interact with your AI coach.'
        }
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Insights & Memories</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search your insights..."
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search results info */}
        {searchResults && (
          <View style={styles.searchResultsInfo}>
            <Text style={styles.searchResultsText}>
              Found {searchResults.total_count} results for "{searchResults.search_query}"
            </Text>
            <TouchableOpacity onPress={handleClearSearch}>
              <Text style={styles.clearSearchText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Memories list */}
        {isLoading && displayMemories.length === 0 ? (
          <SearchSkeleton />
        ) : (
          <FlatList
            data={displayMemories}
            renderItem={renderMemory}
            keyExtractor={(item) => item.id}
            style={styles.memoriesList}
            contentContainerStyle={[
              styles.memoriesContainer,
              displayMemories.length === 0 && styles.memoriesContainerEmpty
            ]}
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Memory detail modal */}
        <MemoryDetailModal
          memory={selectedMemory}
          visible={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedMemory(null);
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6c757d',
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  searchButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007bff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#e7f3ff',
    borderBottomWidth: 1,
    borderBottomColor: '#b3d9ff',
  },
  searchResultsText: {
    fontSize: 14,
    color: '#495057',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#f8d7da',
    borderBottomWidth: 1,
    borderBottomColor: '#f5c6cb',
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
  memoriesList: {
    flex: 1,
  },
  memoriesContainer: {
    padding: 16,
  },
  memoriesContainerEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  memoryItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memoryType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  memoryTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  memoryMeta: {
    alignItems: 'flex-end',
  },
  importanceText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  similarityText: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
  },
  memoryContent: {
    fontSize: 16,
    color: '#212529',
    lineHeight: 22,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#495057',
  },
  moreTagsText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  memoryDate: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  memoryDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  memoryDetailType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007bff',
  },
  memoryDetailScore: {
    fontSize: 14,
    color: '#6c757d',
  },
  memoryDetailContent: {
    fontSize: 16,
    color: '#212529',
    lineHeight: 24,
    marginBottom: 20,
  },
  memoryDetailTags: {
    marginBottom: 20,
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  memoryDetailDate: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 'auto',
  },
  // Skeleton loader styles
  skeletonContainer: {
    padding: 16,
    gap: 12,
  },
  skeletonItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  skeletonType: {
    width: 60,
    height: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
  },
  skeletonScore: {
    width: 80,
    height: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
  },
  skeletonContent: {
    height: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  skeletonTag: {
    width: 50,
    height: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
}); 