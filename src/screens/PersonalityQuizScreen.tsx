import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { generateCorporateSummary } from '../services/corporateSummaryService';

const { width } = Dimensions.get('window');

interface QuizQuestion {
  id: string;
  question: string;
  trait: string;
}

interface PersonalityScores {
  assertiveness: number;
  strategic: number;
  adaptability: number;
  empathy: number;
  conscientiousness: number;
  integrity: number;
}

// 24 questions as specified in the requirements
const quizQuestions: QuizQuestion[] = [
  // Assertiveness (Q1-Q4)
  { id: 'Q1', question: "I'm comfortable pushing back on higher-ups when I believe I'm right.", trait: 'assertiveness' },
  { id: 'Q2', question: "I enjoy taking the lead in group discussions.", trait: 'assertiveness' },
  { id: 'Q3', question: "I can negotiate for what I want without feeling uneasy.", trait: 'assertiveness' },
  { id: 'Q4', question: "Speaking in front of senior leadership energizes me.", trait: 'assertiveness' },
  
  // Strategic Thinking (Q5-Q8)
  { id: 'Q5', question: "I quickly see patterns others miss in complex situations.", trait: 'strategic' },
  { id: 'Q6', question: "I often think several moves ahead before acting.", trait: 'strategic' },
  { id: 'Q7', question: "I can map out multiple paths to the same goal.", trait: 'strategic' },
  { id: 'Q8', question: "I like analyzing power dynamics inside my organization.", trait: 'strategic' },
  
  // Adaptability (Q9-Q12)
  { id: 'Q9', question: "Sudden changes at work rarely throw me off course.", trait: 'adaptability' },
  { id: 'Q10', question: "I can stay calm when priorities shift unexpectedly.", trait: 'adaptability' },
  { id: 'Q11', question: "I adjust my communication style to match different audiences.", trait: 'adaptability' },
  { id: 'Q12', question: "I view setbacks as opportunities to learn.", trait: 'adaptability' },
  
  // Empathy (Q13-Q16)
  { id: 'Q13', question: "I sense when colleagues are uncomfortable even if they don't say so.", trait: 'empathy' },
  { id: 'Q14', question: "People often come to me for advice on interpersonal issues.", trait: 'empathy' },
  { id: 'Q15', question: "I pay close attention to non-verbal cues in meetings.", trait: 'empathy' },
  { id: 'Q16', question: "I modify my arguments based on what matters to the listener.", trait: 'empathy' },
  
  // Conscientiousness (Q17-Q20)
  { id: 'Q17', question: "I double-check details to ensure my work is error-free.", trait: 'conscientiousness' },
  { id: 'Q18', question: "I keep promises, even under tight deadlines.", trait: 'conscientiousness' },
  { id: 'Q19', question: "I plan my day to make steady progress on long-term goals.", trait: 'conscientiousness' },
  { id: 'Q20', question: "Others describe me as reliable and well-prepared.", trait: 'conscientiousness' },
  
  // Integrity (Q21-Q24)
  { id: 'Q21', question: "I refuse to win by bending ethical rules.", trait: 'integrity' },
  { id: 'Q22', question: "I'm transparent about my intentions with teammates.", trait: 'integrity' },
  { id: 'Q23', question: "I own up to my mistakes immediately.", trait: 'integrity' },
  { id: 'Q24', question: "I'd rather lose an argument than mislead someone.", trait: 'integrity' },
];

// Group questions into pages of 6 questions each (4 pages total)
const questionsPerPage = 6;
const totalPages = Math.ceil(quizQuestions.length / questionsPerPage);

const likertOptions = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
];

export const PersonalityQuizScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { user, markOnboardingComplete } = useAuth();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  const startIndex = currentPage * questionsPerPage;
  const endIndex = Math.min(startIndex + questionsPerPage, quizQuestions.length);
  const currentQuestions = quizQuestions.slice(startIndex, endIndex);
  const progress = ((currentPage + 1) / totalPages) * 100;
  
  // Load question-ID mapping from database
  useEffect(() => {
    const loadQuestionMap = async () => {
      try {
        setIsLoadingQuestions(true);
        const { data, error } = await supabase
          .from('onboarding_questions')
          .select('id, question_code');
        
        if (error) {
          console.error('❌ Error loading question map:', error);
          Alert.alert('Error', 'Failed to load questions. Please try again.');
          return;
        }
        
        const map: Record<string, string> = {};
        data?.forEach(question => {
          map[question.question_code] = question.id;
        });
        
        console.log('✅ Question map loaded:', map);
        setQuestionMap(map);
      } catch (error) {
        console.error('❌ Error in loadQuestionMap:', error);
        Alert.alert('Error', 'Failed to load questions. Please try again.');
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    
    loadQuestionMap();
  }, []);
  
  // Debug logging
  console.log(`🔍 Component render - Page ${currentPage + 1}/${totalPages}, Questions: ${startIndex + 1}-${endIndex}`);
  console.log('🔍 Current answers count:', Object.keys(answers).length);
  console.log('🔍 isSubmitting:', isSubmitting);
  console.log('🔍 User:', user?.id);
  console.log('🔍 Question map loaded:', Object.keys(questionMap).length, 'questions');

  const handleAnswerSelect = (questionId: string, value: number) => {
    console.log('📝 Answer selected:', questionId, '=', value);
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionId]: value
      };
      console.log('📝 Updated answers:', newAnswers);
      return newAnswers;
    });
  };

  const calculatePersonalityScores = (): PersonalityScores => {
    const scores: PersonalityScores = {
      assertiveness: 0,
      strategic: 0,
      adaptability: 0,
      empathy: 0,
      conscientiousness: 0,
      integrity: 0,
    };

    const traitCounts: Record<string, number> = {
      assertiveness: 0,
      strategic: 0,
      adaptability: 0,
      empathy: 0,
      conscientiousness: 0,
      integrity: 0,
    };

    // Calculate sum and count for each trait
    quizQuestions.forEach(question => {
      const answer = answers[question.id];
      if (answer) {
        scores[question.trait as keyof PersonalityScores] += answer;
        traitCounts[question.trait]++;
      }
    });

    // Calculate averages (normalize to 0-1 scale)
    Object.keys(scores).forEach(trait => {
      const count = traitCounts[trait];
      if (count > 0) {
        scores[trait as keyof PersonalityScores] = scores[trait as keyof PersonalityScores] / (count * 5); // Divide by count * 5 to normalize
      }
    });

    return scores;
  };

  const savePersonalityData = async (scores: PersonalityScores) => {
    console.log('🚀 savePersonalityData called with scores:', scores);
    
    if (!user?.id) {
      console.error('❌ User not authenticated, user:', user);
      throw new Error('User not authenticated');
    }

    // Check if question map is loaded
    if (Object.keys(questionMap).length === 0) {
      console.error('❌ Question map not loaded');
      throw new Error('Question mapping not loaded. Please try again.');
    }

    try {
      // Get personalization data from route params
      const personalizationData = (route.params as any)?.personalizationData;
      console.log('📋 Personalization data from route:', personalizationData);
      
      // 1. Transform answers into full rows with proper question IDs
      console.log('📝 Transforming and inserting onboarding answers...');
      const rows = Object.entries(answers).map(([code, value]) => {
        const question_id = questionMap[code];
        if (!question_id) {
          throw new Error(`No UUID for question ${code}`);
        }
        return {
          user_id: user.id,
          question_id,
          question_code: code,
          answer_value: { value },
        };
      });

      console.log('📝 Inserting rows:', rows);
      const { error: answersError } = await supabase
        .from('onboarding_answers')
        .insert(rows);

      if (answersError) {
        console.error('❌ Error inserting answers:', answersError);
        throw answersError;
      }

      console.log('✅ Answers inserted successfully');

      // 2. Upsert personalization with scores and completion status
      console.log('📊 Upserting personalization with scores...');
      const { error: personalizationError } = await supabase.rpc('fn_insert_or_update_personalization', {
        p_user_id: user.id,
        p_personality_scores: scores,
        p_onboarding_status: 'completed'
        // omit other p_* fields as they default to NULL and were set in onboarding
      });

      if (personalizationError) {
        console.error('❌ Error upserting personalization:', personalizationError);
        throw personalizationError;
      }

      console.log('✅ Personalization updated successfully');

      // 3. Optionally compute server-side scores
      try {
        console.log('🚀 Calculating server-side personality scores…');
        console.log('🔍 User ID for RPC call:', user.id, 'Type:', typeof user.id);
        
        const { data, error } = await supabase
          .rpc('fn_calculate_personality_scores', { p_user_id: user.id });

        if (error) throw error;
        console.log('✅ Server scores calculated, returned user_id:', data);
      } catch (err) {
        console.warn('⚠️ Warning computing server-side scores (non-critical):', err);
      }

      console.log('🎉 All personality data saved successfully');
    } catch (error) {
      console.error('💥 Error saving personality data:', error);
      throw error;
    }
  };

  const handleNext = async () => {
    console.log('🔥 handleNext fired, currentPage =', currentPage);
    console.log(`handleNext called - Current page: ${currentPage}, Total pages: ${totalPages}`);
    
    // Check if all questions on current page are answered
    const unansweredQuestions = currentQuestions.filter(q => !answers[q.id]);
    if (unansweredQuestions.length > 0) {
      Alert.alert('Complete Page', 'Please answer all questions before continuing');
      return;
    }

    if (currentPage < totalPages - 1) {
      // Animate slide transition and scroll to top
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      setCurrentPage(prev => prev + 1);
      
      // Scroll to top of the new page
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    } else {
      // Quiz completed - validate ALL questions are answered
      const totalAnswered = Object.keys(answers).length;
      const totalQuestions = quizQuestions.length;
      
      console.log(`Quiz completion check: ${totalAnswered}/${totalQuestions} questions answered`);
      
      if (totalAnswered < totalQuestions) {
        const missingQuestions = quizQuestions.filter(q => !answers[q.id]).map(q => q.id);
        console.log('Missing questions:', missingQuestions);
        Alert.alert(
          'Incomplete Assessment', 
          `Please answer all ${totalQuestions} questions before completing the assessment. You have answered ${totalAnswered} questions.`
        );
        return;
      }
      
      // Quiz completed - save results
      console.log('Quiz completed! Starting save process...');
      setIsSubmitting(true);
      
      try {
        const personalityScores = calculatePersonalityScores();
        console.log('Calculated scores:', personalityScores);
        
        await savePersonalityData(personalityScores);
        console.log('Personality data saved successfully!');
        
        // Generate corporate summary after quiz completion
        try {
          console.log('🏢 Generating corporate summary...');
          console.log('🔍 User ID for summary generation:', user.id, 'Type:', typeof user.id);
          
          const summary = await generateCorporateSummary(user.id);
          console.log('✅ Corporate summary generated:', summary);
        } catch (summaryError) {
          console.warn('⚠️ Warning generating corporate summary (non-critical):', summaryError);
          // Don't block the flow if summary generation fails
        }
        
        // Mark onboarding as complete in the auth context
        await markOnboardingComplete();
        
        // Get dominant trait for display
        const maxScore = Math.max(...Object.values(personalityScores));
        const dominantTrait = Object.entries(personalityScores).find(([_, score]) => score === maxScore)?.[0];
        
        const traitLabels = {
          assertiveness: 'Assertive Leader',
          strategic: 'Strategic Thinker',
          adaptability: 'Adaptable Professional',
          empathy: 'Empathetic Collaborator',
          conscientiousness: 'Conscientious Achiever',
          integrity: 'Principled Professional'
        };

        const personalityType = traitLabels[dominantTrait as keyof typeof traitLabels] || 'Balanced Professional';
        
        Alert.alert(
          'Assessment Complete!',
          `Your primary strength: ${personalityType}\n\nYour personalized coaching experience is now ready.`,
          [
            {
              text: 'Continue',
              onPress: () => (navigation as any).navigate('SubscriptionSelection')
            }
          ]
        );
      } catch (error) {
        console.error('💥 Error in handleNext:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save your assessment results. Please try again.';
        Alert.alert(
          'Error',
          errorMessage,
          [
            {
              text: 'Retry',
              onPress: () => setIsSubmitting(false)
            }
          ]
        );
      }
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const getPageTitle = () => {
    const pageTraits = {
      0: 'Leadership & Communication',
      1: 'Strategic Thinking & Adaptability', 
      2: 'Empathy & Relationships',
      3: 'Reliability & Ethics'
    };
    return pageTraits[currentPage as keyof typeof pageTraits] || 'Personality Assessment';
  };

  // Show loading state while questions are being loaded
  if (isLoadingQuestions) {
    return (
      <Container variant="screen">
        <View style={[styles.container, styles.loadingContainer]}>
          <Text style={[styles.loadingText, { color: theme.semanticColors.textPrimary }]}>
            Loading questions...
          </Text>
        </View>
      </Container>
    );
  }

  return (
    <Container variant="screen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.semanticColors.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { backgroundColor: theme.semanticColors.accent, width: `${progress}%` }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: theme.semanticColors.textSecondary }]}>
              Page {currentPage + 1} of {totalPages}
            </Text>
          </View>
          
          <Text style={[styles.title, { color: theme.semanticColors.textPrimary }]}>
            Personality Assessment
          </Text>
          <Text style={[styles.subtitle, { color: theme.semanticColors.textSecondary }]}>
            {getPageTitle()}
          </Text>
        </View>

        {/* Questions */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          nestedScrollEnabled={false}
        >
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            {currentQuestions.map((question, index) => (
            <View key={question.id} style={styles.questionContainer}>
              <Text style={[styles.questionText, { color: theme.semanticColors.textPrimary }]}>
                {startIndex + index + 1}. {question.question}
              </Text>
              
              <View style={styles.likertContainer}>
                {likertOptions.map((option) => {
                  const isSelected = answers[question.id] === option.value;
                  
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.likertOption,
                        {
                          backgroundColor: isSelected ? theme.semanticColors.accent : theme.semanticColors.surface,
                          borderColor: isSelected ? theme.semanticColors.accent : theme.semanticColors.border,
                        }
                      ]}
                      onPress={() => handleAnswerSelect(question.id, option.value)}
                    >
                      <View style={styles.likertContent}>
                        <View style={[
                          styles.radioButton,
                          {
                            borderColor: isSelected ? theme.semanticColors.accent : theme.semanticColors.border,
                            backgroundColor: isSelected ? theme.semanticColors.accent : 'transparent',
                          }
                        ]}>
                          {isSelected && (
                            <View style={[styles.radioInner, { backgroundColor: theme.colors.nearlyBlack }]} />
                          )}
                        </View>
                        <View style={styles.likertLabels}>
                          <Text style={[
                            styles.likertValue,
                            {
                              color: isSelected ? theme.colors.nearlyBlack : theme.semanticColors.textPrimary,
                              fontWeight: isSelected ? '600' : '400'
                            }
                          ]}>
                            {option.value}
                          </Text>
                          <Text style={[
                            styles.likertLabel,
                            {
                              color: isSelected ? theme.colors.nearlyBlack : theme.semanticColors.textSecondary
                            }
                          ]}>
                            {option.label}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          </Animated.View>
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navigation}>
          <Button
            title="Back"
            onPress={handleBack}
            variant="outline"
            style={styles.backButton}
            disabled={isSubmitting || isLoadingQuestions}
          />
          
          <Button
            title={isSubmitting ? 'Saving...' : (currentPage === totalPages - 1 ? 'Complete Assessment' : 'Next')}
            onPress={handleNext}
            variant="cta"
            disabled={isSubmitting || isLoadingQuestions}
            style={styles.nextButton}
          />
        </View>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  questionContainer: {
    marginBottom: 32,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 24,
  },
  likertContainer: {
    gap: 8,
  },
  likertOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  likertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  likertLabels: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  likertValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 20,
  },
  likertLabel: {
    fontSize: 16,
    flex: 1,
  },
  navigation: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
});