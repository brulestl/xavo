import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../providers/ThemeProvider';
import { ListItem } from '../components/ListItem';
import { Ionicons } from '@expo/vector-icons';

// Mock chat history data
const mockChatHistory = [
  {
    id: '1',
    title: 'Stakeholder Analysis Session',
    date: 'Today, 2:30 PM',
    preview: 'Discussed strategies for engaging key stakeholders...',
  },
  {
    id: '2',
    title: 'Email Draft Review',
    date: 'Yesterday, 4:15 PM',
    preview: 'Reviewed and refined the quarterly report email...',
  },
  {
    id: '3',
    title: 'Policy Summary',
    date: 'Dec 5, 10:20 AM',
    preview: 'Summarized the new remote work policy changes...',
  },
  {
    id: '4',
    title: 'Strategic Planning',
    date: 'Dec 4, 3:45 PM',
    preview: 'Brainstormed approaches for the Q1 initiative...',
  },
];

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handleChatPress = (chatId: string, title: string) => {
    // TODO: Navigate to specific chat or load chat history
    console.log('Opening chat:', chatId, title);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.screenBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Chat History
        </Text>
        
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content}>
        {mockChatHistory.length > 0 ? (
          mockChatHistory.map((chat) => (
            <ListItem
              key={chat.id}
              title={chat.title}
              subtitle={`${chat.date} • ${chat.preview}`}
              leftIcon="chatbubbles-outline"
              onPress={() => handleChatPress(chat.id, chat.title)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              No Chat History
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Your conversations will appear here
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 120,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
}); 