import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface QuizQuestion {
  id: string;
  question: string;
  options: {
    text: string;
    value: number;
    trait: string;
  }[];
}

interface PersonalityScores {
  assertiveness: number;
  empathy: number;
  analytical: number;
  collaborative: number;
}

const quizQuestions: QuizQuestion[][] = [
  // Page 1: Communication Style
  [
    {
      id: 'comm1',
      question: 'In meetings, I typically:',
      options: [
        { text: 'Speak up early and often', value: 4, trait: 'assertiveness' },
        { text: 'Share ideas when asked', value: 2, trait: 'assertiveness' },
        { text: 'Listen more than I speak', value: 1, trait: 'empathy' },
        { text: 'Ask clarifying questions', value: 3, trait: 'analytical' },
      ]
    },
    {
      id: 'comm2',
      question: 'When giving feedback, I:',
      options: [
        { text: 'Am direct and to the point', value: 4, trait: 'assertiveness' },
        { text: 'Focus on specific behaviors', value: 3, trait: 'analytical' },
        { text: 'Consider the person\'s feelings first', value: 4, trait: 'empathy' },
        { text: 'Seek input from others first', value: 3, trait: 'collaborative' },
      ]
    },
    {
      id: 'comm3',
      question: 'In conflicts, I prefer to:',
      options: [
        { text: 'Address issues head-on', value: 4, trait: 'assertiveness' },
        { text: 'Find common ground first', value: 4, trait: 'collaborative' },
        { text: 'Understand all perspectives', value: 3, trait: 'empathy' },
        { text: 'Analyze the root cause', value: 3, trait: 'analytical' },
      ]
    }
  ],
  // Page 2: Decision Making
  [
    {
      id: 'decision1',
      question: 'When making important decisions, I:',
      options: [
        { text: 'Trust my gut instinct', value: 3, trait: 'assertiveness' },
        { text: 'Gather extensive data first', value: 4, trait: 'analytical' },
        { text: 'Consult with my team', value: 4, trait: 'collaborative' },
        { text: 'Consider impact on others', value: 4, trait: 'empathy' },
      ]
    },
    {
      id: 'decision2',
      question: 'Under pressure, I:',
      options: [
        { text: 'Make quick decisive choices', value: 4, trait: 'assertiveness' },
        { text: 'Stick to proven methods', value: 2, trait: 'analytical' },
        { text: 'Rally the team together', value: 3, trait: 'collaborative' },
        { text: 'Stay calm and supportive', value: 3, trait: 'empathy' },
      ]
    },
    {
      id: 'decision3',
      question: 'I\'m most comfortable when:',
      options: [
        { text: 'Leading the charge', value: 4, trait: 'assertiveness' },
        { text: 'Having all the facts', value: 4, trait: 'analytical' },
        { text: 'Working as part of a team', value: 4, trait: 'collaborative' },
        { text: 'Everyone feels heard', value: 4, trait: 'empathy' },
      ]
    }
  ],
  // Page 3: Relationship Building
  [
    {
      id: 'relationship1',
      question: 'I build relationships by:',
      options: [
        { text: 'Being confident and direct', value: 3, trait: 'assertiveness' },
        { text: 'Sharing knowledge and insights', value: 3, trait: 'analytical' },
        { text: 'Finding ways to collaborate', value: 4, trait: 'collaborative' },
        { text: 'Showing genuine interest in others', value: 4, trait: 'empathy' },
      ]
    },
    {
      id: 'relationship2',
      question: 'When someone disagrees with me, I:',
      options: [
        { text: 'Stand firm on my position', value: 4, trait: 'assertiveness' },
        { text: 'Present supporting evidence', value: 4, trait: 'analytical' },
        { text: 'Look for compromise solutions', value: 4, trait: 'collaborative' },
        { text: 'Try to understand their viewpoint', value: 4, trait: 'empathy' },
      ]
    },
    {
      id: 'relationship3',
      question: 'I gain influence through:',
      options: [
        { text: 'Strong leadership presence', value: 4, trait: 'assertiveness' },
        { text: 'Expertise and competence', value: 4, trait: 'analytical' },
        { text: 'Building alliances', value: 4, trait: 'collaborative' },
        { text: 'Earning trust and respect', value: 4, trait: 'empathy' },
      ]
    }
  ],
  // Page 4: Work Style
  [
    {
      id: 'workstyle1',
      question: 'My ideal work environment is:',
      options: [
        { text: 'Fast-paced and challenging', value: 4, trait: 'assertiveness' },
        { text: 'Structured and data-driven', value: 4, trait: 'analytical' },
        { text: 'Collaborative and team-oriented', value: 4, trait: 'collaborative' },
        { text: 'Supportive and inclusive', value: 4, trait: 'empathy' },
      ]
    },
    {
      id: 'workstyle2',
      question: 'I\'m energized by:',
      options: [
        { text: 'Taking on new challenges', value: 4, trait: 'assertiveness' },
        { text: 'Solving complex problems', value: 4, trait: 'analytical' },
        { text: 'Successful team projects', value: 4, trait: 'collaborative' },
        { text: 'Helping others succeed', value: 4, trait: 'empathy' },
      ]
    },
    {
      id: 'workstyle3',
      question: 'Success to me means:',
      options: [
        { text: 'Achieving ambitious goals', value: 4, trait: 'assertiveness' },
        { text: 'Making data-driven improvements', value: 4, trait: 'analytical' },
        { text: 'Building strong teams', value: 4, trait: 'collaborative' },
        { text: 'Creating positive impact', value: 4, trait: 'empathy' },
      ]
    }
  ]
];

export const PersonalityQuizScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { value: number; trait: string }>>({});
  
  const currentQuestions = quizQuestions[currentPage];
  const totalPages = quizQuestions.length;
  const progress = ((currentPage + 1) / totalPages) * 100;

  const handleAnswerSelect = (questionId: string, option: { value: number; trait: string }) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  const calculatePersonalityScores = (): PersonalityScores => {
    const scores: PersonalityScores = {
      assertiveness: 0,
      empathy: 0,
      analytical: 0,
      collaborative: 0,
    };

    const traitCounts: Record<string, number> = {
      assertiveness: 0,
      empathy: 0,
      analytical: 0,
      collaborative: 0,
    };

    Object.values(answers).forEach(answer => {
      scores[answer.trait as keyof PersonalityScores] += answer.value;
      traitCounts[answer.trait]++;
    });

    // Normalize scores (average them)
    Object.keys(scores).forEach(trait => {
      const count = traitCounts[trait];
      if (count > 0) {
        scores[trait as keyof PersonalityScores] = scores[trait as keyof PersonalityScores] / count;
      }
    });

    return scores;
  };

  const getPersonalityType = (scores: PersonalityScores): string => {
    const maxScore = Math.max(...Object.values(scores));
    const dominantTrait = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
    
    const types = {
      assertiveness: 'The Leader',
      analytical: 'The Strategist',
      collaborative: 'The Connector',
      empathy: 'The Supporter'
    };

    return types[dominantTrait as keyof typeof types] || 'The Balanced Professional';
  };

  const handleNext = () => {
    // Check if all questions on current page are answered
    const unansweredQuestions = currentQuestions.filter(q => !answers[q.id]);
    if (unansweredQuestions.length > 0) {
      Alert.alert('Complete Page', 'Please answer all questions before continuing');
      return;
    }

    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      // Quiz completed
      const personalityScores = calculatePersonalityScores();
      const personalityType = getPersonalityType(personalityScores);
      
      console.log('Personality Quiz Results:', {
        scores: personalityScores,
        type: personalityType,
        personalizationData: route.params
      });

      // Navigate to dashboard or completion screen
      Alert.alert(
        'Quiz Complete!',
        `Your personality type: ${personalityType}`,
        [
          {
            text: 'Continue',
            onPress: () => (navigation as any).navigate('Dashboard')
          }
        ]
      );
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <Container variant="screen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { backgroundColor: theme.accent, width: `${progress}%` }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {currentPage + 1} of {totalPages}
            </Text>
          </View>
          
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Personality Assessment
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {currentPage === 0 && 'Communication Style'}
            {currentPage === 1 && 'Decision Making'}
            {currentPage === 2 && 'Relationship Building'}
            {currentPage === 3 && 'Work Style'}
          </Text>
        </View>

        {/* Questions */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {currentQuestions.map((question, index) => (
            <View key={question.id} style={styles.questionContainer}>
              <Text style={[styles.questionText, { color: theme.textPrimary }]}>
                {index + 1}. {question.question}
              </Text>
              
              <View style={styles.optionsContainer}>
                {question.options.map((option, optionIndex) => {
                  const isSelected = answers[question.id]?.value === option.value && 
                                   answers[question.id]?.trait === option.trait;
                  
                  return (
                    <TouchableOpacity
                      key={optionIndex}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: isSelected ? theme.accent : theme.surface,
                          borderColor: isSelected ? theme.accent : theme.border,
                        }
                      ]}
                      onPress={() => handleAnswerSelect(question.id, option)}
                    >
                      <View style={styles.optionContent}>
                        <View style={[
                          styles.radioButton,
                          {
                            borderColor: isSelected ? theme.accent : theme.border,
                            backgroundColor: isSelected ? theme.accent : 'transparent',
                          }
                        ]}>
                          {isSelected && (
                            <Ionicons name="checkmark" size={12} color={theme.colors.eerieBlack} />
                          )}
                        </View>
                        <Text style={[
                          styles.optionText,
                          {
                            color: isSelected ? theme.colors.eerieBlack : theme.textPrimary
                          }
                        ]}>
                          {option.text}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navigation}>
          {currentPage > 0 && (
            <Button
              title="Back"
              onPress={handleBack}
              variant="outline"
              style={styles.backButton}
            />
          )}
          
          <Button
            title={currentPage === totalPages - 1 ? 'Complete Quiz' : 'Next'}
            onPress={handleNext}
            fullWidth={currentPage === 0}
            style={currentPage > 0 ? styles.nextButton : undefined}
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
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  optionContent: {
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
  optionText: {
    fontSize: 16,
    flex: 1,
    lineHeight: 22,
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
});