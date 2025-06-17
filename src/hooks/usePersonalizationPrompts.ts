import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

interface PersonalizationData {
  current_position?: string;
  primary_function?: string;
  top_challenges?: string[];
  metadata?: {
    personalityAnswers?: {
      communication_style?: string;
      conflict_approach?: string;
      decision_making?: string;
    };
  };
}

export function usePersonalizationPrompts() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalizationData, setPersonalizationData] = useState<PersonalizationData | null>(null);

  const generatePrompts = (data: PersonalizationData): string[] => {
    const generatedPrompts: string[] = [];
    
    // Role-based prompts
    if (data.current_position && data.primary_function) {
      generatedPrompts.push(
        `As a ${data.current_position} in ${data.primary_function}, how can I boost my effectiveness?`
      );
    } else if (data.current_position) {
      generatedPrompts.push(
        `What are the key influence strategies for someone in my role as ${data.current_position}?`
      );
    }

    // Challenge-based prompts
    if (data.top_challenges && data.top_challenges.length > 0) {
      const primaryChallenge = data.top_challenges[0];
      generatedPrompts.push(`How do I handle ${primaryChallenge.toLowerCase()}?`);
      
      if (data.top_challenges.length > 1) {
        const secondaryChallenge = data.top_challenges[1];
        generatedPrompts.push(`What's the best approach for dealing with ${secondaryChallenge.toLowerCase()}?`);
      }
    }

    // Personality-based prompts
    const personalityAnswers = data.metadata?.personalityAnswers;
    if (personalityAnswers) {
      if (personalityAnswers.communication_style) {
        generatedPrompts.push(
          `How can I improve my ${personalityAnswers.communication_style.toLowerCase()} communication style?`
        );
      }
      
      if (personalityAnswers.conflict_approach) {
        generatedPrompts.push(
          `Help me refine my ${personalityAnswers.conflict_approach.toLowerCase()} approach to conflict resolution.`
        );
      }
      
      if (personalityAnswers.decision_making) {
        generatedPrompts.push(
          `How can I leverage my ${personalityAnswers.decision_making.toLowerCase()} decision-making style for better influence?`
        );
      }
    }

    // Default prompts if no personalization data
    if (generatedPrompts.length === 0) {
      generatedPrompts.push(
        "How can I build more influence in my workplace?",
        "What are effective strategies for managing up?",
        "How do I navigate office politics professionally?",
        "What's the best way to communicate with difficult colleagues?",
        "How can I improve my leadership presence?"
      );
    }

    // Ensure we always return exactly 5 prompts
    const finalPrompts = generatedPrompts.slice(0, 5);
    
    // If we don't have enough personalized prompts, fill with defaults
    while (finalPrompts.length < 5) {
      const defaultPrompts = [
        "How can I build more influence in my workplace?",
        "What are effective strategies for managing up?",
        "How do I navigate office politics professionally?",
        "What's the best way to communicate with difficult colleagues?",
        "How can I improve my leadership presence?",
        "What strategies help me gain visibility in my organization?",
        "How do I handle pushback on my ideas effectively?",
        "What's the key to building strong stakeholder relationships?",
        "How can I negotiate more successfully?",
        "What techniques improve my executive presence?"
      ];
      
      // Add defaults that aren't already in the list
      for (const defaultPrompt of defaultPrompts) {
        if (!finalPrompts.includes(defaultPrompt) && finalPrompts.length < 5) {
          finalPrompts.push(defaultPrompt);
        }
      }
      break; // Prevent infinite loop
    }
    
    return finalPrompts;
  };

  useEffect(() => {
    const fetchPersonalizationData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_personalization')
          .select('current_position, primary_function, top_challenges, metadata')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching personalization data:', error);
          // Generate default prompts on error
          setPrompts(generatePrompts({}));
          setPersonalizationData({});
        } else {
          // Generate prompts based on user data
          const userData = data || {};
          setPrompts(generatePrompts(userData));
          setPersonalizationData(userData);
        }
      } catch (error) {
        console.error('Error in fetchPersonalizationData:', error);
        // Generate default prompts on error
        setPrompts(generatePrompts({}));
        setPersonalizationData({});
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalizationData();
  }, [user?.id]);

  return { prompts, loading, personalizationData };
} 