import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';

const FIRST_QUESTIONS = `Ready to transform your relationships?

Whether you're navigating workplace dynamics, strengthening personal connections, or developing leadership skills, our AI coach is here to guide you through every conversation that matters.

Get personalized advice, practice difficult conversations, and build the confidence to handle any relationship challenge with grace and authenticity.`;

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handleGetStarted = () => {
    navigation.navigate('AuthChoice' as never);
  };

  return (
    <Container variant="screen">
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={[styles.questionsText, { color: theme.textPrimary }]}>
            {FIRST_QUESTIONS}
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            size="large"
            fullWidth
          />
        </View>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  questionsText: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '400',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
}); 