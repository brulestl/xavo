import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { monitoring } from '../services/monitoring';
import usePurchases from '../hooks/usePurchases';

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
  packageId?: string;
}

const getSubscriptionPlans = (packages: any[]): SubscriptionPlan[] => {
  const monthlyPackage = packages.find(pkg => 
    pkg.product.identifier.includes('monthly')
  );
  const yearlyPackage = packages.find(pkg => 
    pkg.product.identifier.includes('yearly')
  );

  return [
    {
      id: 'strategist_monthly',
      name: 'Power Strategist',
      price: monthlyPackage?.product.priceString || '$29',
      period: '/month',
      description: 'Perfect for emerging leaders',
      features: [
        { text: 'Unlimited coaching conversations', included: true },
        { text: 'Personalized leadership insights', included: true },
        { text: 'Advanced AI coaching', included: true },
        { text: 'Progress tracking', included: true },
        { text: 'Voice message support', included: true },
        { text: 'Priority support', included: true },
      ],
      buttonText: 'Start Free Trial',
      packageId: monthlyPackage?.identifier,
    },
    {
      id: 'strategist_yearly',
      name: 'Power Strategist',
      price: yearlyPackage?.product.priceString || '$299',
      period: '/year',
      description: 'Best value - Save 33%',
      features: [
        { text: 'Everything in monthly plan', included: true },
        { text: 'Save 33% compared to monthly', included: true },
        { text: 'Advanced analytics & insights', included: true },
        { text: 'Custom coaching scenarios', included: true },
        { text: 'Executive-level strategies', included: true },
        { text: '1-on-1 coaching sessions', included: true },
      ],
      recommended: true,
      buttonText: 'Start Free Trial',
      packageId: yearlyPackage?.identifier,
    },
  ];
};

export const SubscriptionSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, markOnboardingComplete } = useAuth();
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  
  const {
    isLoading,
    isPurchasing,
    isRestoring,
    packages,
    isSubscribed,
    purchasePackage,
    restorePurchases,
    getPackage,
  } = usePurchases(user?.id);

  useEffect(() => {
    if (packages.length > 0) {
      const plans = getSubscriptionPlans(packages);
      setSubscriptionPlans(plans);
    }
  }, [packages]);

  // Track paywall view when screen mounts
  useEffect(() => {
    monitoring.trackPaywallViewed('onboarding_flow', user?.tier || 'trial');
    monitoring.trackScreenView('SubscriptionSelection', {
      source: 'onboarding',
      packages_loaded: packages.length > 0,
    });
  }, [user?.tier, packages.length]);

  const handlePlanSelect = async (plan: SubscriptionPlan) => {
    if (!plan.packageId) {
      Alert.alert(
        'Package Not Available',
        'This subscription package is currently not available. Please try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    const packageToBuy = getPackage(plan.packageId);
    if (!packageToBuy) {
      Alert.alert(
        'Package Not Found',
        'Could not find the selected subscription package. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await purchasePackage(packageToBuy);
      if (result) {
        // Track successful purchase
        const price = parseFloat(packageToBuy.product.price.toString());
        monitoring.trackPurchaseCompleted(plan.packageId!, price, user?.id || '');
        
        // Purchase successful, mark onboarding as complete and navigate
        await markOnboardingComplete();
        (navigation as any).navigate('Main');
      }
    } catch (error) {
      // Track purchase failure
      monitoring.trackError(error as Error, 'purchase_failed', {
        plan_id: plan.packageId,
        user_id: user?.id,
      });
      
      // Error handling is done in the usePurchases hook
      console.error('Purchase error:', error);
    }
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
        title={isPurchasing ? 'Processing...' : plan.buttonText}
        onPress={() => handlePlanSelect(plan)}
        variant={plan.recommended ? 'cta' : 'outline'}
        style={styles.planButton}
        disabled={isPurchasing || isLoading}
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