import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { Pill } from '../components/Pill';
import { Composer } from '../components/Composer';
import { Drawer } from '../components/Drawer';
import { SettingsDrawer } from '../components/SettingsDrawer';

// Mock data - TODO: Replace with actual user data from onboarding
const HERO_QUESTIONS = [
  "What's blocking your next move?",
  "How can I help you navigate this challenge?",
  "What conversation are you avoiding?",
  "What leadership skill needs work?",
];

const QUICK_PROMPTS = [
  "Difficult conversation prep",
  "Team conflict resolution",
  "Salary negotiation tips",
  "Leadership presence",
  "Networking strategies",
];

export const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { clearAllData } = useAuth();
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isSettingsDrawerVisible, setIsSettingsDrawerVisible] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [heroQuestion] = useState(HERO_QUESTIONS[0]); // TODO: Make this contextual
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Animate content on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSendMessage = (message: string) => {
    // TODO: Implement chat functionality
    console.log('Sending message:', message);
  };

  const handlePromptPress = (prompt: string) => {
    setSelectedPrompt(selectedPrompt === prompt ? null : prompt);
    // TODO: Auto-populate composer with prompt
  };

  const handleMenuPress = () => {
    setIsDrawerVisible(true);
  };

  const handleSettingsPress = () => {
    setIsSettingsDrawerVisible(true);
  };

  const handleNavigateToSubscriptions = () => {
    setIsSettingsDrawerVisible(false);
    navigation.navigate('Subscriptions' as never);
  };

  const handleNavigateToOnboardingEdit = () => {
    setIsSettingsDrawerVisible(false);
    navigation.navigate('OnboardingEdit' as never);
  };

  const handleUpload = () => {
    // TODO: Implement file upload
    console.log('Upload pressed');
  };

  const handleVoiceNote = () => {
    // TODO: Implement voice note
    console.log('Voice note pressed');
  };

  const handleClearData = async () => {
    console.log('Clearing all data...');
    await clearAllData();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
          <View style={[styles.hamburger, { backgroundColor: theme.semanticColors.textPrimary }]} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
          <Ionicons 
            name="settings-outline" 
            size={24} 
            color={theme.semanticColors.textPrimary} 
          />
        </TouchableOpacity>
        
        {/* Temporary Clear Data Button */}
        {__DEV__ && (
          <TouchableOpacity 
            style={[styles.settingsButton, { backgroundColor: '#ff4444', borderRadius: 4, marginLeft: 8 }]} 
            onPress={handleClearData}
          >
            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>CLEAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Hero Question */}
          <Text style={[styles.heroQuestion, { color: theme.semanticColors.textPrimary }]}>
            {heroQuestion}
          </Text>

          {/* Quick Prompts */}
          <View style={styles.promptsContainer}>
            {QUICK_PROMPTS.slice(0, 5).map((prompt, index) => (
              <Pill
                key={index}
                title={prompt}
                variant={selectedPrompt === prompt ? 'selected' : 'default'}
                onPress={() => handlePromptPress(prompt)}
                style={styles.prompt}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Composer */}
      <View style={styles.composerContainer}>
        <Composer
          onSend={handleSendMessage}
          onUpload={handleUpload}
          onVoiceNote={handleVoiceNote}
          placeholder="What's on your mind?"
        />
      </View>

      {/* Drawer */}
      <Drawer
        isVisible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
        title="Conversations"
      >
        <View style={styles.drawerContent}>
          <Text style={[styles.drawerText, { color: theme.semanticColors.textSecondary }]}>
            Your past conversations will appear here.
          </Text>
          {/* TODO: Add conversation history */}
        </View>
      </Drawer>

      {/* Settings Drawer */}
      <SettingsDrawer
        isVisible={isSettingsDrawerVisible}
        onClose={() => setIsSettingsDrawerVisible(false)}
        onNavigateToSubscriptions={handleNavigateToSubscriptions}
        onNavigateToOnboardingEdit={handleNavigateToOnboardingEdit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  menuButton: {
    padding: 8,
  },
  hamburger: {
    width: 20,
    height: 2,
    marginVertical: 2,
    borderRadius: 1,
  },
  settingsButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  heroQuestion: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 36,
  },
  promptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  prompt: {
    marginBottom: 12,
  },
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  drawerContent: {
    paddingVertical: 20,
  },
  drawerText: {
    fontSize: 16,
    textAlign: 'center',
  },
}); 