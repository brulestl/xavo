import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { PlanCard } from '../components/ui/PlanCard';

const planData = {
  guest: {
    planName: 'Free Plan',
    price: '$0',
    priceSubtext: '/month',
    features: [
      { text: '3 questions per day', included: true },
      { text: 'Basic AI coaching', included: true },
      { text: 'Limited conversation history', included: true },
      { text: 'Email support', included: false },
      { text: 'Advanced personality insights', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  essential: {
    planName: 'Essential',
    price: '$0',
    priceSubtext: '/month',
    features: [
      { text: '3 questions per day', included: true },
      { text: 'Full AI coaching access', included: true },
      { text: 'Complete conversation history', included: true },
      { text: 'Personality assessment', included: true },
      { text: 'Email support', included: true },
      { text: 'Priority support', included: false },
    ],
  },
  power: {
    planName: 'Power Strategist',
    price: '$30',
    priceSubtext: '/month',
    features: [
      { text: 'Unlimited questions', included: true },
      { text: 'Advanced AI coaching', included: true },
      { text: 'Full conversation history', included: true },
      { text: 'Advanced personality insights', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Exclusive coaching content', included: true },
    ],
  },
};

export const SubscriptionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { tier } = useAuth();

  const handlePlanAction = (planTier: string, actionType: string) => {
    // TODO: Integrate Stripe payment processing
    Alert.alert(
      'Coming Soon',
      `${actionType} to ${planTier} plan will be available soon!`,
      [{ text: 'OK', style: 'default' }]
    );
  };

  const getPlanCTA = (planTier: string) => {
    if (planTier === tier) {
      return {
        text: 'Current Plan',
        type: 'current' as const,
      };
    }

    switch (planTier) {
      case 'power':
        return tier === 'guest' || tier === 'essential'
          ? { text: 'Upgrade to Power', type: 'upgrade' as const }
          : { text: 'Current Plan', type: 'current' as const };
      case 'essential':
        return tier === 'guest'
          ? { text: 'Start Free Trial', type: 'upgrade' as const }
          : tier === 'power'
          ? { text: 'Downgrade', type: 'downgrade' as const }
          : { text: 'Current Plan', type: 'current' as const };
      case 'guest':
        return tier !== 'guest'
          ? { text: 'Downgrade to Free', type: 'downgrade' as const }
          : { text: 'Current Plan', type: 'current' as const };
      default:
        return { text: 'Select Plan', type: 'upgrade' as const };
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.semanticColors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.semanticColors.textPrimary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.semanticColors.textPrimary }]}>
          Subscriptions
        </Text>
        
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Text */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: theme.semanticColors.textPrimary }]}>
            Choose Your Plan
          </Text>
          <Text style={[styles.subtitle, { color: theme.semanticColors.textSecondary }]}>
            Unlock your full potential with our AI coaching plans
          </Text>
        </View>

        {/* Free Plan */}
        <PlanCard
          planName={planData.guest.planName}
          tier="guest"
          price={planData.guest.price}
          priceSubtext={planData.guest.priceSubtext}
          features={planData.guest.features}
          ctaText={getPlanCTA('guest').text}
          ctaType={getPlanCTA('guest').type}
          onPress={() => handlePlanAction('Free', getPlanCTA('guest').text)}
        />

        {/* Essential Plan */}
        <PlanCard
          planName={planData.essential.planName}
          tier="essential"
          price={planData.essential.price}
          priceSubtext={planData.essential.priceSubtext}
          features={planData.essential.features}
          ctaText={getPlanCTA('essential').text}
          ctaType={getPlanCTA('essential').type}
          onPress={() => handlePlanAction('Essential', getPlanCTA('essential').text)}
        />

        {/* Power Plan */}
        <PlanCard
          planName={planData.power.planName}
          tier="power"
          price={planData.power.price}
          priceSubtext={planData.power.priceSubtext}
          features={planData.power.features}
          ctaText={getPlanCTA('power').text}
          ctaType={getPlanCTA('power').type}
          onPress={() => handlePlanAction('Power Strategist', getPlanCTA('power').text)}
          highlighted={true} // Most popular
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.semanticColors.textSecondary }]}>
            All plans include secure data encryption and can be cancelled anytime.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerSection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 