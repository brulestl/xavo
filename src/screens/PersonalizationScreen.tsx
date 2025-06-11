import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';

interface PersonalizationData {
  industry: string;
  role: string;
  experience: string;
  goals: string[];
  challenges: string[];
}

const industries = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing',
  'Retail', 'Consulting', 'Government', 'Non-profit', 'Other'
];

const roles = [
  'Individual Contributor', 'Team Lead', 'Manager', 'Director',
  'VP/Executive', 'C-Suite', 'Consultant', 'Entrepreneur'
];

const experienceLevels = [
  '0-2 years', '3-5 years', '6-10 years', '11-15 years', '15+ years'
];

const commonGoals = [
  'Build stronger relationships',
  'Improve communication skills',
  'Navigate office politics',
  'Advance my career',
  'Lead more effectively',
  'Resolve conflicts better',
  'Increase my influence',
  'Build a better network'
];

const commonChallenges = [
  'Difficult colleagues',
  'Unclear expectations',
  'Limited resources',
  'Workplace conflicts',
  'Communication barriers',
  'Lack of recognition',
  'Work-life balance',
  'Career advancement'
];

export const PersonalizationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  
  const [data, setData] = useState<PersonalizationData>({
    industry: '',
    role: '',
    experience: '',
    goals: [],
    challenges: [],
  });

  const handleIndustrySelect = (industry: string) => {
    setData(prev => ({ ...prev, industry }));
  };

  const handleRoleSelect = (role: string) => {
    setData(prev => ({ ...prev, role }));
  };

  const handleExperienceSelect = (experience: string) => {
    setData(prev => ({ ...prev, experience }));
  };

  const handleGoalToggle = (goal: string) => {
    setData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const handleChallengeToggle = (challenge: string) => {
    setData(prev => ({
      ...prev,
      challenges: prev.challenges.includes(challenge)
        ? prev.challenges.filter(c => c !== challenge)
        : [...prev.challenges, challenge]
    }));
  };

  const handleContinue = () => {
    if (!data.industry || !data.role || !data.experience) {
      Alert.alert('Incomplete', 'Please fill in all required fields');
      return;
    }

    if (data.goals.length === 0) {
      Alert.alert('Select Goals', 'Please select at least one goal');
      return;
    }

    // Save personalization data (you can integrate with your storage solution)
    console.log('Personalization data:', data);
    
    // Navigate to personality quiz
    (navigation as any).navigate('PersonalityQuiz', { personalizationData: data });
  };

  const renderSelectionGrid = (
    items: string[],
    selectedItem: string,
    onSelect: (item: string) => void
  ) => (
    <View style={styles.selectionGrid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.selectionItem,
            {
              backgroundColor: selectedItem === item ? theme.accent : theme.surface,
              borderColor: selectedItem === item ? theme.accent : theme.border,
            }
          ]}
          onPress={() => onSelect(item)}
        >
          <Text style={[
            styles.selectionText,
            {
              color: selectedItem === item ? theme.colors.eerieBlack : theme.textPrimary
            }
          ]}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMultiSelectGrid = (
    items: string[],
    selectedItems: string[],
    onToggle: (item: string) => void
  ) => (
    <View style={styles.selectionGrid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.selectionItem,
            {
              backgroundColor: selectedItems.includes(item) ? theme.accent : theme.surface,
              borderColor: selectedItems.includes(item) ? theme.accent : theme.border,
            }
          ]}
          onPress={() => onToggle(item)}
        >
          <Text style={[
            styles.selectionText,
            {
              color: selectedItems.includes(item) ? theme.colors.eerieBlack : theme.textPrimary
            }
          ]}>
            {item}
          </Text>
          {selectedItems.includes(item) && (
            <Ionicons 
              name="checkmark-circle" 
              size={16} 
              color={theme.colors.eerieBlack} 
              style={styles.checkmark}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Container variant="screen">
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Let's Personalize Your Experience
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Help us understand your professional context to provide better coaching
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            What industry do you work in? *
          </Text>
          {renderSelectionGrid(industries, data.industry, handleIndustrySelect)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            What's your current role? *
          </Text>
          {renderSelectionGrid(roles, data.role, handleRoleSelect)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            How much professional experience do you have? *
          </Text>
          {renderSelectionGrid(experienceLevels, data.experience, handleExperienceSelect)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            What are your main goals? (Select all that apply)
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Choose at least one
          </Text>
          {renderMultiSelectGrid(commonGoals, data.goals, handleGoalToggle)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            What challenges do you face? (Optional)
          </Text>
          {renderMultiSelectGrid(commonChallenges, data.challenges, handleChallengeToggle)}
        </View>

        <View style={styles.footer}>
          <Button
            title="Continue to Personality Assessment"
            onPress={handleContinue}
            fullWidth
          />
        </View>
      </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  selectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  selectionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkmark: {
    marginLeft: 8,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
  },
});