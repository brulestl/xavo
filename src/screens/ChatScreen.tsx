import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { ActionButton } from '../components/ActionButton';
import ChatComposer from '../../components/ChatComposer';
import { Ionicons } from '@expo/vector-icons';

type ChatScreenNavigationProp = DrawerNavigationProp<any>;

const actionButtons = [
  { title: 'Evaluate Scenario', icon: 'analytics-outline' as const },
  { title: 'Plan Strategy', icon: 'map-outline' as const },
  { title: 'Analyze Stakeholders', icon: 'people-outline' as const },
  { title: 'Summarize Policy', icon: 'document-text-outline' as const },
  { title: 'Brainstorm Insights', icon: 'bulb-outline' as const },
  { title: 'Draft Email', icon: 'mail-outline' as const },
];

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { theme } = useTheme();
  const { user, tier, canMakeQuery } = useAuth();
  const [inputText, setInputText] = useState('');

  const handleActionPress = (actionTitle: string) => {
    if (!canMakeQuery()) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      actionTitle,
      `This will start a ${actionTitle.toLowerCase()} session. This feature is coming soon!`,
      [{ text: 'Got it' }]
    );
  };

  const handleSendMessage = (message: string) => {
    if (!canMakeQuery()) {
      Alert.alert(
        'Query Limit Reached',
        'You have reached your daily query limit. Upgrade to Power Strategist for unlimited queries.',
        [{ text: 'OK' }]
      );
      return;
    }

    // TODO: Implement actual chat functionality
    Alert.alert('Message Sent', `You said: "${message}"`);
  };

  const handleImageUpload = () => {
    Alert.alert('Image Upload', 'Image upload feature coming soon!');
  };

  const handleMicPress = () => {
    if (tier !== 'power') {
      Alert.alert(
        'Premium Feature',
        'Voice features are available for Power Strategist tier only.',
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert('Voice Input', 'Voice input feature coming soon!');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.screenBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.openDrawer()}
        >
          <Ionicons name="menu" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Corporate Influence Coach
        </Text>
        
        <View style={styles.menuButton} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Action Buttons Grid */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.gridContainer}>
            {actionButtons.map((button, index) => (
              <View key={index} style={styles.gridItem}>
                <ActionButton
                  title={button.title}
                  icon={button.icon}
                  onPress={() => handleActionPress(button.title)}
                  disabled={!canMakeQuery()}
                />
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Chat Composer */}
        <View style={[styles.composerContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <ChatComposer
            onSend={handleSendMessage}
            voiceEnabled={tier === 'power'}
            disabled={!canMakeQuery()}
            accentColor={theme.accent}
            onMicPress={handleMicPress}
          />
          
          {/* Image Upload Button */}
          <TouchableOpacity
            style={[styles.imageButton, { borderColor: theme.border }]}
            onPress={handleImageUpload}
          >
            <Ionicons name="camera" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  menuButton: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
}); 