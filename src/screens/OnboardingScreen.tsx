import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, Alert } from 'react-native';
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

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    role: '',
    companySize: '',
    function: '',
    challenges: [],
    personalityAnswers: {},
  });
  
  const scrollViewRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const updateProgress = (step: number) => {
    Animated.timing(progressAnim, {
      toValue: step,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const saveOnboardingData = async () => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('🚀 Saving onboarding data to Supabase...');
      const { error } = await supabase.rpc('fn_insert_or_update_personalization', {
        p_user_id: user.id,
        p_current_position: onboardingData.role,
        p_company_size: onboardingData.companySize,
        p_primary_function: onboardingData.function,
        p_top_challenges: onboardingData.challenges,
        p_preferred_coaching_style: onboardingData.personalityAnswers.decision_making || null,
        p_onboarding_status: 'in_progress'
        // omit p_personality_scores here; defaults to NULL
      });

      if (error) {
        console.error('❌ Error saving onboarding data:', error);
        throw error;
      }

      console.log('✅ Onboarding data saved successfully');
    } catch (error) {
      console.error('💥 Error in saveOnboardingData:', error);
      throw error;
    }
  };

  const handleNext = async () => {
    if (currentStep < 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateProgress(nextStep);
      scrollViewRef.current?.scrollTo({ x: nextStep * screenWidth, animated: true });
    } else {
      // Save onboarding data and navigate to personality quiz
      setLoading(true);
      
      try {
        await saveOnboardingData();
        
        console.log('Quick profile complete:', onboardingData);
        (navigation as any).navigate('PersonalityQuiz', { personalizationData: onboardingData });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save your profile. Please try again.';
        Alert.alert('Error', errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateProgress(prevStep);
      scrollViewRef.current?.scrollTo({ x: prevStep * screenWidth, animated: true });
    }
  };

  const updateProfile = (field: keyof OnboardingData, value: any) => {
    setOnboardingData(prev => ({ ...prev, [field]: value }));
  };

  const toggleChallenge = (challenge: string) => {
    setOnboardingData(prev => ({
      ...prev,
      challenges: prev.challenges.includes(challenge)
        ? prev.challenges.filter(c => c !== challenge)
        : [...prev.challenges, challenge],
    }));
  };

  const updatePersonalityAnswer = (questionId: string, answer: string) => {
    setOnboardingData(prev => ({
      ...prev,
      personalityAnswers: { ...prev.personalityAnswers, [questionId]: answer },
    }));
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['50%', '100%'],
  });

  const canProceed = currentStep === 0 
    ? onboardingData.role && onboardingData.companySize && onboardingData.function
    : Object.keys(onboardingData.personalityAnswers).length === PERSONALITY_QUESTIONS.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressTrack, { backgroundColor: theme.semanticColors.border }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: theme.semanticColors.primary,
                width: progressWidth,
              },
            ]}
          />
        </View>
        <View style={styles.dotsContainer}>
          {[0, 1].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: currentStep >= index 
                    ? theme.semanticColors.primary 
                    : theme.semanticColors.border,
                },
              ]}
            />
          ))}
        </View>
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
              Help us understand your context
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

        {/* Step 2: Personality Quiz */}
        <View style={[styles.step, { width: screenWidth }]}>
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepTitle, { color: theme.semanticColors.textPrimary }]}>
              Personality Quiz
            </Text>
            <Text style={[styles.stepSubtitle, { color: theme.semanticColors.textSecondary }]}>
              2 minutes to personalize your experience
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
            disabled={loading}
          />
        )}
        <Button
          title={loading ? 'Saving...' : (currentStep === 1 ? 'Get Started' : 'Next')}
          variant="cta"
          onPress={handleNext}
          disabled={!canProceed || loading}
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  step: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
    lineHeight: 24,
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
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  navButton: {
    minWidth: 100,
  },
}); 