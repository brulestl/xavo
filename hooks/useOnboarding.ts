import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { apiFetch } from '../src/lib/api';

export interface OnboardingQuestion {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'scale' | 'text' | 'boolean';
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  category: 'personalization' | 'personality';
  order_index: number;
}

export interface OnboardingAnswer {
  question_id: string;
  answer_value: string | number;
  answer_text?: string;
}

export interface OnboardingProgress {
  current_page: number;
  total_pages: number;
  questions_answered: number;
  total_questions: number;
  is_complete: boolean;
}

interface UseOnboardingReturn {
  questions: OnboardingQuestion[];
  currentQuestions: OnboardingQuestion[];
  answers: Record<string, OnboardingAnswer>;
  progress: OnboardingProgress;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchQuestions: (page?: number, limit?: number) => Promise<void>;
  submitAnswer: (questionId: string, value: string | number, text?: string) => void;
  submitAllAnswers: () => Promise<boolean>;
  completeOnboarding: () => Promise<boolean>;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
  resetOnboarding: () => void;
}

export const useOnboarding = (): UseOnboardingReturn => {
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<OnboardingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, OnboardingAnswer>>({});
  const [progress, setProgress] = useState<OnboardingProgress>({
    current_page: 1,
    total_pages: 1,
    questions_answered: 0,
    total_questions: 0,
    is_complete: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const QUESTIONS_PER_PAGE = 5;

  // Fetch questions with pagination
  const fetchQuestions = async (page: number = 1, limit: number = QUESTIONS_PER_PAGE) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        questions: OnboardingQuestion[];
        total_pages: number;
        total_questions: number;
      }>(`/onboarding/questions?page=${page}&limit=${limit}`);
      
      // Update questions state
      if (page === 1) {
        setQuestions(data.questions || []);
      } else {
        setQuestions(prev => [...prev, ...(data.questions || [])]);
      }

      // Update current page questions
      setCurrentQuestions(data.questions || []);

      // Update progress
      setProgress(prev => ({
        ...prev,
        current_page: page,
        total_pages: data.total_pages || 1,
        total_questions: data.total_questions || 0,
        questions_answered: Object.keys(answers).length
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch questions';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit individual answer
  const submitAnswer = (questionId: string, value: string | number, text?: string) => {
    const answer: OnboardingAnswer = {
      question_id: questionId,
      answer_value: value,
      answer_text: text
    };

    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));

    // Update progress
    setProgress(prev => ({
      ...prev,
      questions_answered: Object.keys({ ...answers, [questionId]: answer }).length
    }));
  };

  // Submit all answers to backend
  const submitAllAnswers = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const answersArray = Object.values(answers);
      
      if (answersArray.length === 0) {
        throw new Error('No answers to submit');
      }

      const result = await apiFetch<{ success: boolean; message?: string }>('/onboarding/answers', {
        method: 'POST',
        body: JSON.stringify({ answers: answersArray })
      });
      
      // Update progress based on response
      if (result.success) {
        setProgress(prev => ({
          ...prev,
          questions_answered: answersArray.length
        }));
        return true;
      } else {
        throw new Error(result.message || 'Failed to submit answers');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit answers';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Complete onboarding process
  const completeOnboarding = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // First submit any remaining answers
      const submitSuccess = await submitAllAnswers();
      if (!submitSuccess) {
        return false;
      }

      // Mark onboarding as complete
      const result = await apiFetch<{ success: boolean; message?: string }>('/onboarding/complete', {
        method: 'PUT'
      });
      
      if (result.success) {
        setProgress(prev => ({
          ...prev,
          is_complete: true
        }));
        return true;
      } else {
        throw new Error(result.message || 'Failed to complete onboarding');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete onboarding';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation helpers
  const nextPage = () => {
    if (progress.current_page < progress.total_pages) {
      const nextPageNum = progress.current_page + 1;
      fetchQuestions(nextPageNum);
    }
  };

  const previousPage = () => {
    if (progress.current_page > 1) {
      const prevPageNum = progress.current_page - 1;
      fetchQuestions(prevPageNum);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= progress.total_pages) {
      fetchQuestions(page);
    }
  };

  // Reset onboarding state
  const resetOnboarding = () => {
    setQuestions([]);
    setCurrentQuestions([]);
    setAnswers({});
    setProgress({
      current_page: 1,
      total_pages: 1,
      questions_answered: 0,
      total_questions: 0,
      is_complete: false
    });
    setError(null);
  };

  // Load initial questions on mount
  useEffect(() => {
    fetchQuestions(1);
  }, []);

  return {
    questions,
    currentQuestions,
    answers,
    progress,
    isLoading,
    error,
    
    // Actions
    fetchQuestions,
    submitAnswer,
    submitAllAnswers,
    completeOnboarding,
    nextPage,
    previousPage,
    goToPage,
    resetOnboarding
  };
}; 