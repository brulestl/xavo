import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { Container } from '../components/Container';
import { Button } from '../components/Button';

const { width } = Dimensions.get('window');

interface PlanFeature {
  text: string;
  included: boolean;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  recommended?: boolean;
  buttonText: string;
}

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'strategist',
    name: 'Strategist',
    price: '$29',
    period: '/month',
    description: 'Perfect for emerging leaders',
    features: [
      { text: 'Unlimited coaching conversations', included: true },
      { text: 'Personalized leadership insights', included: true },
      { text: 'Weekly progress reports', included: true },
      { text: 'Email support', included: true },
      { text: 'Advanced analytics', included: false },
      { text: 'Priority support', included: false },
    ],
    buttonText: 'Start Free Trial',
  },
  {
    id: 'shark',
    name: 'Shark',
    price: '$79',
    period: '/month',
    description: 'For executive-level professionals',
    features: [
      { text: 'Everything in Strategist', included: true },
      { text: 'Advanced analytics & insights', included: true },
      { text: 'Priority support', included: true },
      { text: 'Custom coaching scenarios', included: true },
      { text: 'Executive-level strategies', included: true },
      { text: '1-on-1 coaching sessions', included: true },
    ],
    recommended: true,
    buttonText: 'Start Free Trial',
  },
];

export const SubscriptionSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handlePlanSelect = (planId: string) => {
    // Mock subscription selection - for now just navigate to dashboard
    console.log('Selected plan:', planId);
    (navigation as any).navigate('Main');
  };

  const handleSkip = () => {
    // Allow user to skip and go to dashboard with trial
    (navigation as any).navigate('Main');
  };

  const renderPlan = (plan: SubscriptionPlan) => (
    <View
      key={plan.id}
      style={[
        styles.planCard,
        {
          backgroundColor: theme.semanticColors.cardBackground,
          borderColor: plan.recommended ? theme.semanticColors.accent : theme.semanticColors.border,
          borderWidth: plan.recommended ? 2 : 1,
        },
      ]}
    >
      {plan.recommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: theme.semanticColors.accent }]}>
          <Text style={[styles.recommendedText, { color: theme.colors.nearlyBlack }]}>
            Recommended
          </Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Text style={[styles.planName, { color: theme.semanticColors.textPrimary }]}>
          {plan.name}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={[styles.planPrice, { color: theme.semanticColors.textPrimary }]}>
            {plan.price}
          </Text>
          <Text style={[styles.planPeriod, { color: theme.semanticColors.textSecondary }]}>
            {plan.period}
          </Text>
        </View>
        <Text style={[styles.planDescription, { color: theme.semanticColors.textSecondary }]}>
          {plan.description}
        </Text>
      </View>

      <View style={styles.featuresContainer}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons
              name={feature.included ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={feature.included ? '#28a745' : theme.semanticColors.textSecondary}
            />
            <Text
              style={[
                styles.featureText,
                {
                  color: feature.included ? theme.semanticColors.textPrimary : theme.semanticColors.textSecondary,
                  opacity: feature.included ? 1 : 0.6,
                },
              ]}
            >
              {feature.text}
            </Text>
          </View>
        ))}
      </View>

      <Button
        title={plan.buttonText}
        onPress={() => handlePlanSelect(plan.id)}
        variant={plan.recommended ? 'cta' : 'outline'}
        style={styles.planButton}
      />
    </View>
  );

  return (
    <Container variant="screen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.semanticColors.textPrimary }]}>
            Choose Your Plan
          </Text>
          <Text style={[styles.subtitle, { color: theme.semanticColors.textSecondary }]}>
            Unlock your full leadership potential with personalized coaching
          </Text>
        </View>

        {/* Plans */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.plansContainer}>
            {subscriptionPlans.map(renderPlan)}
          </View>

          {/* Skip Option */}
          <View style={styles.skipContainer}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: theme.semanticColors.textSecondary }]}>
                Continue with free trial
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    alignItems: 'center',
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
  content: {
    flex: 1,
  },
  plansContainer: {
    paddingHorizontal: 24,
    gap: 20,
  },
  planCard: {
    borderRadius: 16,
    padding: 24,
    position: 'relative',
    marginBottom: 16,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: 24,
    right: 24,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  planPeriod: {
    fontSize: 16,
    marginLeft: 4,
  },
  planDescription: {
    fontSize: 16,
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  planButton: {
    marginTop: 8,
  },
  skipContainer: {
    padding: 24,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
}); 