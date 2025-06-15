import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { apiFetch } from '../src/lib/api';

export interface UserProfile {
  user_id: string;
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  created_at: string;
  updated_at: string;
}

export interface UserPersonalization {
  user_id: string;
  communication_style: string;
  preferred_topics: string[];
  goals: string[];
  learning_preferences: string[];
  timezone: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface PersonalityInterpretation {
  openness: string;
  conscientiousness: string;
  extraversion: string;
  agreeableness: string;
  neuroticism: string;
}

export interface ProfileData {
  profile: UserProfile | null;
  personalization: UserPersonalization | null;
  interpretation: PersonalityInterpretation | null;
}

interface UseProfileReturn {
  profileData: ProfileData;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadProfile: () => Promise<void>;
  updatePersonalization: (updates: Partial<UserPersonalization>) => Promise<boolean>;
  refreshPersonalityScores: () => Promise<boolean>;
  getPersonalityInsights: () => PersonalityInterpretation | null;
}

export const useProfile = (): UseProfileReturn => {
  const [profileData, setProfileData] = useState<ProfileData>({
    profile: null,
    personalization: null,
    interpretation: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load complete profile data
  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        profile?: UserProfile;
        personalization?: UserPersonalization;
      }>('/profile/me');
      
      const newProfileData: ProfileData = {
        profile: data.profile || null,
        personalization: data.personalization || null,
        interpretation: data.profile ? generatePersonalityInterpretation(data.profile) : null
      };

      setProfileData(newProfileData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Update personalization settings
  const updatePersonalization = async (updates: Partial<UserPersonalization>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedPersonalization = await apiFetch<UserPersonalization>('/profile/personalization', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        personalization: updatedPersonalization
      }));
      
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update personalization';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh personality scores (recalculate from onboarding answers)
  const refreshPersonalityScores = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedProfile = await apiFetch<UserProfile>('/profile/personality');
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        profile: updatedProfile,
        interpretation: generatePersonalityInterpretation(updatedProfile)
      }));
      
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh personality scores';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Generate personality interpretation
  const generatePersonalityInterpretation = (profile: UserProfile): PersonalityInterpretation => {
    const interpretations: PersonalityInterpretation = {
      openness: '',
      conscientiousness: '',
      extraversion: '',
      agreeableness: '',
      neuroticism: ''
    };

    // Openness interpretation
    if (profile.openness > 0.7) {
      interpretations.openness = 'High openness - You enjoy new experiences, are creative, and open to change. You likely appreciate innovation and diverse perspectives.';
    } else if (profile.openness < 0.3) {
      interpretations.openness = 'Low openness - You prefer routine, practical approaches, and traditional methods. You value stability and proven solutions.';
    } else {
      interpretations.openness = 'Moderate openness - You balance new experiences with established methods, adapting based on the situation.';
    }

    // Conscientiousness interpretation
    if (profile.conscientiousness > 0.7) {
      interpretations.conscientiousness = 'High conscientiousness - You are organized, disciplined, and goal-oriented. You excel at planning and following through on commitments.';
    } else if (profile.conscientiousness < 0.3) {
      interpretations.conscientiousness = 'Low conscientiousness - You are flexible, spontaneous, and adaptable. You prefer to keep options open and respond to opportunities as they arise.';
    } else {
      interpretations.conscientiousness = 'Moderate conscientiousness - You balance planning with flexibility, organizing when needed while staying adaptable.';
    }

    // Extraversion interpretation
    if (profile.extraversion > 0.7) {
      interpretations.extraversion = 'High extraversion - You are energetic, outgoing, and enjoy social interaction. You likely thrive in collaborative environments and public speaking.';
    } else if (profile.extraversion < 0.3) {
      interpretations.extraversion = 'Low extraversion (introverted) - You prefer quiet environments and deep, meaningful conversations. You work well independently and think before speaking.';
    } else {
      interpretations.extraversion = 'Moderate extraversion - You are comfortable in both social and solitary situations, adapting your energy to the context.';
    }

    // Agreeableness interpretation
    if (profile.agreeableness > 0.7) {
      interpretations.agreeableness = 'High agreeableness - You are cooperative, trusting, and empathetic. You excel at building consensus and maintaining harmonious relationships.';
    } else if (profile.agreeableness < 0.3) {
      interpretations.agreeableness = 'Low agreeableness - You are competitive, skeptical, and direct. You are comfortable with conflict and prioritize results over harmony.';
    } else {
      interpretations.agreeableness = 'Moderate agreeableness - You balance cooperation with assertiveness, adapting your approach based on the situation.';
    }

    // Neuroticism interpretation
    if (profile.neuroticism > 0.7) {
      interpretations.neuroticism = 'High neuroticism - You may experience stress more intensely and benefit from support systems. You are likely very aware of potential risks and challenges.';
    } else if (profile.neuroticism < 0.3) {
      interpretations.neuroticism = 'Low neuroticism - You are emotionally stable and calm under pressure. You handle stress well and maintain composure in challenging situations.';
    } else {
      interpretations.neuroticism = 'Moderate neuroticism - You have typical emotional responses to stress and can manage challenges with appropriate support.';
    }

    return interpretations;
  };

  // Get current personality insights
  const getPersonalityInsights = (): PersonalityInterpretation | null => {
    return profileData.interpretation;
  };

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  return {
    profileData,
    isLoading,
    error,
    
    // Actions
    loadProfile,
    updatePersonalization,
    refreshPersonalityScores,
    getPersonalityInsights
  };
}; 