import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface DocumentSource {
  documentId: string;
  filename: string;
  page: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

interface DocumentSourcesProps {
  sources: DocumentSource[];
  compact?: boolean;
}

export const DocumentSources: React.FC<DocumentSourcesProps> = ({
  sources,
  compact = false,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const rotateValue = useRef(new Animated.Value(0)).current;

  if (!sources || sources.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
    
    Animated.timing(rotateValue, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleSourcePress = (index: number) => {
    setSelectedSource(selectedSource === index ? null : index);
  };

  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}% match`;
  };

  const getSourceIcon = (filename: string) => {
    if (filename.endsWith('.pdf')) return 'document-text-outline';
    if (filename.endsWith('.txt')) return 'document-outline';
    if (filename.endsWith('.docx') || filename.endsWith('.doc')) return 'document-text-outline';
    return 'document-outline';
  };

  const rotateInterpolation = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: theme.semanticColors.surface }]}>
        <View style={styles.compactHeader}>
          <Ionicons 
            name="library-outline" 
            size={14} 
            color={theme.semanticColors.primary} 
          />
          <Text style={[styles.compactText, { color: theme.semanticColors.textSecondary }]}>
            {sources.length} source{sources.length !== 1 ? 's' : ''} • {sources[0].filename}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.surface, borderColor: theme.semanticColors.border }]}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: theme.semanticColors.primary + '20' }]}>
            <Ionicons 
              name="library-outline" 
              size={16} 
              color={theme.semanticColors.primary} 
            />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.sourcesTitle, { color: theme.semanticColors.textPrimary }]}>
              Document Sources
            </Text>
            <Text style={[styles.sourcesCount, { color: theme.semanticColors.textSecondary }]}>
              {sources.length} source{sources.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        </View>
        
        <Animated.View style={{ transform: [{ rotate: rotateInterpolation }] }}>
          <Ionicons 
            name="chevron-down-outline" 
            size={20} 
            color={theme.semanticColors.textSecondary} 
          />
        </Animated.View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.sourcesContainer}>
          <ScrollView 
            style={styles.sourcesList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {sources.map((source, index) => (
              <View key={`${source.documentId}-${source.chunkIndex}`} style={styles.sourceItem}>
                <TouchableOpacity
                  style={[
                    styles.sourceHeader,
                    { borderBottomColor: theme.semanticColors.border }
                  ]}
                  onPress={() => handleSourcePress(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sourceHeaderLeft}>
                    <Ionicons 
                      name={getSourceIcon(source.filename) as any} 
                      size={16} 
                      color={theme.semanticColors.primary} 
                    />
                    <View style={styles.sourceInfo}>
                      <Text 
                        style={[styles.sourceFilename, { color: theme.semanticColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {source.filename}
                      </Text>
                      <View style={styles.sourceMetadata}>
                        <Text style={[styles.sourceDetails, { color: theme.semanticColors.textSecondary }]}>
                          Page {source.page}
                        </Text>
                        <Text style={styles.separator}>•</Text>
                        <Text style={[styles.sourceDetails, { color: theme.semanticColors.primary }]}>
                          {formatSimilarity(source.similarity)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <Ionicons 
                    name={selectedSource === index ? "chevron-up-outline" : "chevron-down-outline"} 
                    size={16} 
                    color={theme.semanticColors.textSecondary} 
                  />
                </TouchableOpacity>

                {selectedSource === index && (
                  <View style={[styles.sourceContent, { backgroundColor: theme.semanticColors.background }]}>
                    <Text style={[styles.contentLabel, { color: theme.semanticColors.textSecondary }]}>
                      Relevant excerpt:
                    </Text>
                    <Text style={[styles.sourceText, { color: theme.semanticColors.textPrimary }]}>
                      {source.content}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  compactContainer: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 12,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  sourcesTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sourcesCount: {
    fontSize: 12,
    marginTop: 1,
  },
  sourcesContainer: {
    maxHeight: 300,
  },
  sourcesList: {
    flex: 1,
  },
  sourceItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sourceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sourceInfo: {
    marginLeft: 10,
    flex: 1,
  },
  sourceFilename: {
    fontSize: 13,
    fontWeight: '500',
  },
  sourceMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sourceDetails: {
    fontSize: 11,
  },
  separator: {
    color: '#999',
    marginHorizontal: 6,
    fontSize: 11,
  },
  sourceContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  contentLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
  sourceText: {
    fontSize: 12,
    lineHeight: 16,
  },
}); 