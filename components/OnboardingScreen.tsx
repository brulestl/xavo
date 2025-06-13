import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useOnboarding, OnboardingQuestion } from '../hooks/useOnboarding';

// Skeleton loader component
const SkeletonLoader: React.FC = () => (
  <View style={styles.skeletonContainer}>
    {[1, 2, 3, 4, 5].map((index) => (
      <View key={index} style={styles.skeletonItem}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonOptions}>
          <View style={styles.skeletonOption} />
          <View style={styles.skeletonOption} />
          <View style={styles.skeletonOption} />
        </View>
      </View>
    ))}
  </View>
);

// Question component
const QuestionItem: React.FC<{
  question: OnboardingQuestion;
  answer: any;
  onAnswer: (value: string | number, text?: string) => void;
}> = ({ question, answer, onAnswer }) => {
  const renderQuestionInput = () => {
    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <View style={styles.optionsContainer}>
            {question.options?.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  answer?.answer_value === option && styles.optionButtonSelected,
                ]}
                onPress={() => onAnswer(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    answer?.answer_value === option && styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'scale':
        const scaleMin = question.scale_min || 1;
        const scaleMax = question.scale_max || 5;
        const scaleOptions = Array.from(
          { length: scaleMax - scaleMin + 1 },
          (_, i) => scaleMin + i
        );

        return (
          <View style={styles.scaleContainer}>
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabel}>Strongly Disagree</Text>
              <Text style={styles.scaleLabel}>Strongly Agree</Text>
            </View>
            <View style={styles.scaleOptions}>
              {scaleOptions.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.scaleButton,
                    answer?.answer_value === value && styles.scaleButtonSelected,
                  ]}
                  onPress={() => onAnswer(value)}
                >
                  <Text
                    style={[
                      styles.scaleButtonText,
                      answer?.answer_value === value && styles.scaleButtonTextSelected,
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'text':
        return (
          <TextInput
            style={styles.textInput}
            placeholder="Enter your answer..."
            value={answer?.answer_text || ''}
            onChangeText={(text) => onAnswer(text, text)}
            multiline
            numberOfLines={3}
          />
        );

      case 'boolean':
        return (
          <View style={styles.booleanContainer}>
            <TouchableOpacity
              style={[
                styles.booleanButton,
                answer?.answer_value === 'yes' && styles.booleanButtonSelected,
              ]}
              onPress={() => onAnswer('yes')}
            >
              <Text
                style={[
                  styles.booleanText,
                  answer?.answer_value === 'yes' && styles.booleanTextSelected,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.booleanButton,
                answer?.answer_value === 'no' && styles.booleanButtonSelected,
              ]}
              onPress={() => onAnswer('no')}
            >
              <Text
                style={[
                  styles.booleanText,
                  answer?.answer_value === 'no' && styles.booleanTextSelected,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.questionContainer}>
      <Text style={styles.questionText}>{question.question_text}</Text>
      <Text style={styles.questionCategory}>
        {question.category === 'personalization' ? 'Personal Info' : 'Personality Assessment'}
      </Text>
      {renderQuestionInput()}
    </View>
  );
};

export const OnboardingScreen: React.FC = () => {
  const {
    currentQuestions,
    answers,
    progress,
    isLoading,
    error,
    submitAnswer,
    nextPage,
    previousPage,
    completeOnboarding,
  } = useOnboarding();

  const handleAnswer = (questionId: string, value: string | number, text?: string) => {
    submitAnswer(questionId, value, text);
  };

  const handleNext = async () => {
    if (progress.current_page < progress.total_pages) {
      nextPage();
    } else {
      // Last page - complete onboarding
      const success = await completeOnboarding();
      if (success) {
        Alert.alert(
          'Onboarding Complete!',
          'Thank you for completing the onboarding process. Your profile has been created.',
          [{ text: 'Continue', onPress: () => {/* Navigate to main app */} }]
        );
      }
    }
  };

  const handlePrevious = () => {
    if (progress.current_page > 1) {
      previousPage();
    }
  };

  const isPageComplete = () => {
    return currentQuestions.every(question => answers[question.id]);
  };

  const getProgressPercentage = () => {
    return (progress.questions_answered / progress.total_questions) * 100;
  };

  if (isLoading && currentQuestions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Setting up your profile...</Text>
        </View>
        <SkeletonLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Corporate Influence Coach</Text>
        <Text style={styles.subtitle}>
          Help us personalize your experience by answering a few questions
        </Text>
        
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${getProgressPercentage()}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {progress.questions_answered} of {progress.total_questions} questions
          </Text>
        </View>
      </View>

      {/* Questions */}
      <ScrollView style={styles.questionsContainer} showsVerticalScrollIndicator={false}>
        {currentQuestions.map((question) => (
          <QuestionItem
            key={question.id}
            question={question}
            answer={answers[question.id]}
            onAnswer={(value, text) => handleAnswer(question.id, value, text)}
          />
        ))}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.previousButton,
            progress.current_page === 1 && styles.navButtonDisabled,
          ]}
          onPress={handlePrevious}
          disabled={progress.current_page === 1}
        >
          <Text style={[
            styles.navButtonText,
            progress.current_page === 1 && styles.navButtonTextDisabled,
          ]}>
            Previous
          </Text>
        </TouchableOpacity>

        <Text style={styles.pageIndicator}>
          {progress.current_page} of {progress.total_pages}
        </Text>

        <TouchableOpacity
          style={[
            styles.navButton,
            styles.nextButton,
            !isPageComplete() && styles.navButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!isPageComplete() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[
              styles.navButtonText,
              !isPageComplete() && styles.navButtonTextDisabled,
            ]}>
              {progress.current_page === progress.total_pages ? 'Complete' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 20,
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  questionsContainer: {
    flex: 1,
    padding: 20,
  },
  questionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
    lineHeight: 24,
  },
  questionCategory: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
  },
  optionButtonSelected: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  optionText: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#007bff',
    fontWeight: '600',
  },
  scaleContainer: {
    gap: 16,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  scaleOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scaleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  scaleButtonSelected: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  scaleButtonText: {
    fontSize: 16,
    color: '#495057',
    fontWeight: '600',
  },
  scaleButtonTextSelected: {
    color: '#007bff',
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#495057',
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  booleanContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  booleanButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  booleanButtonSelected: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  booleanText: {
    fontSize: 16,
    color: '#495057',
    fontWeight: '600',
  },
  booleanTextSelected: {
    color: '#007bff',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  navButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  previousButton: {
    backgroundColor: '#6c757d',
  },
  nextButton: {
    backgroundColor: '#007bff',
  },
  navButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  navButtonTextDisabled: {
    color: '#adb5bd',
  },
  pageIndicator: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#f8d7da',
    borderTopWidth: 1,
    borderTopColor: '#f5c6cb',
  },
  errorText: {
    color: '#721c24',
    textAlign: 'center',
    fontSize: 14,
  },
  // Skeleton loader styles
  skeletonContainer: {
    padding: 20,
    gap: 16,
  },
  skeletonItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skeletonTitle: {
    height: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonOptions: {
    gap: 12,
  },
  skeletonOption: {
    height: 48,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
}); 