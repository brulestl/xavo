import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';

const { width: screenWidth } = Dimensions.get('window');

interface OnboardingData {
  role: string;
  companySize: string;
  function: string;
  challenges: string[];
  personalityAnswers: { [key: string]: string };
}

// Using exact same options as original onboarding
const ROLES = ['Associate', 'Analyst', 'Intern', 'Individual Contributor', 'Manager', 'Director', 'VP', 'C-Level', 'Consultant'];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const FUNCTIONS = ['Sales', 'Marketing', 'Engineering', 'Product', 'Operations', 'HR', 'Finance'];
const CHALLENGES = [
  'Difficult conversations',
  'Team conflicts',
  'Leadership presence',
  'Networking',
  'Salary negotiations',
  'Public speaking',
];

const PERSONALITY_QUESTIONS = [
  {
    id: 'communication_style',
    question: 'How do you prefer to communicate?',
    options: ['Direct & concise', 'Detailed & thorough', 'Collaborative & inclusive', 'Adaptive to situation'],
  },
  {
    id: 'conflict_approach',
    question: 'When facing conflict, you typically:',
    options: ['Address it head-on', 'Seek to understand all sides', 'Find compromise', 'Avoid when possible'],
  },
  {
    id: 'decision_making',
    question: 'Your decision-making style is:',
    options: ['Quick & decisive', 'Analytical & thorough', 'Consensus-building', 'Intuitive'],
  },
];

export const OnboardingEditScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, refreshPersonalization } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    role: '',
    companySize: '',
    function: '',
    challenges: [],
    personalityAnswers: {},
  });

  useEffect(() => {
    loadExistingData();
  }, []);

  const updateProgress = (step: number) => {
    Animated.timing(progressAnim, {
      toValue: step,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const loadExistingData = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_personalization')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

      const personalization = data || {};
      
      // Map server data to component structure
      setOnboardingData({
        role: personalization.current_position || '',
        companySize: personalization.company_size || '',
        function: personalization.primary_function || '',
        challenges: personalization.top_challenges || [],
        personalityAnswers: personalization.metadata?.personalityAnswers || {},
      });

    } catch (error) {
      console.error('Error loading existing data:', error);
      Alert.alert('Error', 'Failed to load your profile data');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = (field: keyof OnboardingData, value: any) => {
    console.log('🔧 Updating field:', field, 'with value:', value);
    setOnboardingData(prev => ({ ...prev, [field]: value }));
  };

  const toggleChallenge = (challenge: string) => {
    console.log('🔥 Toggling challenge:', challenge);
    setOnboardingData(prev => {
      const newChallenges = prev.challenges.includes(challenge)
        ? prev.challenges.filter(c => c !== challenge)
        : [...prev.challenges, challenge];
      console.log('🔥 New challenges:', newChallenges);
      return { ...prev, challenges: newChallenges };
    });
  };

  const updatePersonalityAnswer = (questionId: string, answer: string) => {
    console.log('🧠 Updating personality answer:', questionId, answer);
    setOnboardingData(prev => ({
      ...prev,
      personalityAnswers: { ...prev.personalityAnswers, [questionId]: answer },
    }));
  };

  const handleNext = async () => {
    if (currentStep < 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateProgress(nextStep);
      scrollViewRef.current?.scrollTo({ x: nextStep * screenWidth, animated: true });
    } else {
      // Save data and navigate back to home
      await handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateProgress(prevStep);
      scrollViewRef.current?.scrollTo({ x: prevStep * screenWidth, animated: true });
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      setSaving(true);

      // Prepare metadata with personality answers
      const metadata = {
        personalityAnswers: onboardingData.personalityAnswers
      };

      // Map component data back to server structure and save
      const { error } = await supabase
        .from('user_personalization')
        .upsert({
          user_id: user.id,
          current_position: onboardingData.role,
          company_size: onboardingData.companySize,
          primary_function: onboardingData.function,
          top_challenges: onboardingData.challenges,
          preferred_coaching_style: onboardingData.personalityAnswers.communication_style || null,
          onboarding_status: 'completed', // Required by constraint
          metadata: metadata,
          updated_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        });

      if (error) throw error;

      console.log('✅ Profile data saved successfully to database');
      await refreshPersonalization();
      console.log('✅ Personalization refreshed');

      // Navigate back immediately
      console.log('🏠 Navigating back to home screen...');
      try {
        // Try multiple navigation options
        if ((navigation as any).navigate) {
          console.log('🏠 Trying navigation to Home...');
          (navigation as any).goBack();
        } else {
          console.log('🏠 Using goBack...');
          navigation.goBack();
        }
      } catch (navError) {
        console.error('❌ Navigation error, using goBack:', navError);
        navigation.goBack();
      }

      // Show success message after navigation
      setTimeout(() => {
        Alert.alert('Success', 'Your profile has been updated!');
      }, 100);

    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 = onboardingData.role && onboardingData.companySize && onboardingData.function;
  const canProceedStep2 = Object.keys(onboardingData.personalityAnswers).length >= 3; // All 3 personality questions answered

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.semanticColors.background }]}>
        <ActivityIndicator size="large" color={theme.semanticColors.primary} />
        <Text style={[styles.loadingText, { color: theme.semanticColors.textSecondary }]}>
          Loading your profile...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: theme.semanticColors.primary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.semanticColors.textPrimary }]}>
          Edit Profile
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressFill, 
              { 
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['50%', '100%'],
                })
              }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: theme.semanticColors.textSecondary }]}>
          Step {currentStep + 1} of 2
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scrollView}
      >
        {/* Step 1: Quick Profile */}
        <View style={[styles.step, { width: screenWidth }]}>
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepTitle, { color: theme.semanticColors.textPrimary }]}>
              Quick Profile
            </Text>
            <Text style={[styles.stepSubtitle, { color: theme.semanticColors.textSecondary }]}>
              Update your basic profile information
            </Text>

            {/* Role Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                Your Role
              </Text>
              <View style={styles.optionsContainer}>
                {ROLES.map((role) => (
                  <Pill
                    key={role}
                    title={role}
                    variant={onboardingData.role === role ? 'selected' : 'default'}
                    onPress={() => updateProfile('role', role)}
                    style={styles.option}
                  />
                ))}
              </View>
            </View>

            {/* Company Size */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                Company Size
              </Text>
              <View style={styles.optionsContainer}>
                {COMPANY_SIZES.map((size) => (
                  <Pill
                    key={size}
                    title={size}
                    variant={onboardingData.companySize === size ? 'selected' : 'default'}
                    onPress={() => updateProfile('companySize', size)}
                    style={styles.option}
                  />
                ))}
              </View>
            </View>

            {/* Function */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                Function
              </Text>
              <View style={styles.optionsContainer}>
                {FUNCTIONS.map((func) => (
                  <Pill
                    key={func}
                    title={func}
                    variant={onboardingData.function === func ? 'selected' : 'default'}
                    onPress={() => updateProfile('function', func)}
                    style={styles.option}
                  />
                ))}
              </View>
            </View>

            {/* Challenges */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                Key Challenges (Select all that apply)
              </Text>
              <View style={styles.optionsContainer}>
                {CHALLENGES.map((challenge) => (
                  <Pill
                    key={challenge}
                    title={challenge}
                    variant={onboardingData.challenges.includes(challenge) ? 'selected' : 'default'}
                    onPress={() => toggleChallenge(challenge)}
                    style={styles.option}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Step 2: Personality Preferences */}
        <View style={[styles.step, { width: screenWidth }]}>
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepTitle, { color: theme.semanticColors.textPrimary }]}>
              Personality Preferences
            </Text>
            <Text style={[styles.stepSubtitle, { color: theme.semanticColors.textSecondary }]}>
              Update your communication and work style preferences
            </Text>

            {PERSONALITY_QUESTIONS.map((q, index) => (
              <View key={q.id} style={styles.section}>
                <Text style={[styles.questionText, { color: theme.semanticColors.textPrimary }]}>
                  {index + 1}. {q.question}
                </Text>
                <View style={styles.optionsContainer}>
                  {q.options.map((option) => (
                    <Pill
                      key={option}
                      title={option}
                      variant={onboardingData.personalityAnswers[q.id] === option ? 'selected' : 'default'}
                      onPress={() => updatePersonalityAnswer(q.id, option)}
                      style={styles.option}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        {currentStep > 0 && (
          <Button
            title="Back"
            variant="outline"
            onPress={handleBack}
            style={styles.navButton}
            disabled={saving}
          />
        )}
        <Button
          title={saving ? 'Saving...' : (currentStep === 1 ? 'Save Changes' : 'Next')}
          variant="cta"
          onPress={handleNext}
          disabled={(!canProceedStep1 && currentStep === 0) || (!canProceedStep2 && currentStep === 1) || saving}
          style={[styles.navButton, { flex: 1, marginLeft: currentStep > 0 ? 12 : 0 }]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    minWidth: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  step: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    marginBottom: 8,
  },
  navigation: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  navButton: {
    minHeight: 48,
  },
}); 