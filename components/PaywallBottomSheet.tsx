import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface PaywallBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  source?: 'query_limit' | 'feature_gate' | 'onboarding';
}

interface TrialStatus {
  isEligible: boolean;
  daysRemaining?: number;
  hasUsedTrial: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PaywallBottomSheet({ visible, onClose, source = 'query_limit' }: PaywallBottomSheetProps) {
  const { subscribePower, email, tier } = useAuth();
  const [loading, setLoading] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    isEligible: true,
    hasUsedTrial: false,
  });

  useEffect(() => {
    if (visible && email) {
      checkTrialEligibility();
    }
  }, [visible, email]);

  const checkTrialEligibility = async () => {
    try {
      // Check if user has already used their trial
      // This would typically be a call to your backend/Stripe
      // For now, we'll simulate this with local storage or user metadata
      const hasUsedTrial = false; // Replace with actual check
      const isCurrentlyOnTrial = tier === 'power' && false; // Check if currently on trial
      
      setTrialStatus({
        isEligible: !hasUsedTrial && !isCurrentlyOnTrial,
        hasUsedTrial,
        daysRemaining: isCurrentlyOnTrial ? 2 : undefined, // Example remaining days
      });
    } catch (error) {
      console.error('Error checking trial eligibility:', error);
      setTrialStatus({
        isEligible: false,
        hasUsedTrial: true,
      });
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      // Start 3-day trial
      // This would integrate with Stripe to create a trial subscription
      // For now, we'll use the existing subscribePower method
      await subscribePower();
      
      Alert.alert(
        'Trial Started!',
        'You now have 3 days of unlimited access to Power Strategist features. We\'ll remind you before your trial ends.',
        [{ text: 'Get Started', onPress: onClose }]
      );
    } catch (error) {
      console.error('Trial start failed:', error);
      Alert.alert(
        'Trial Start Failed',
        'We couldn\'t start your trial. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await subscribePower(); // Direct subscription
      
      Alert.alert(
        'Upgrade Successful!',
        'Welcome to Power Strategist! You now have unlimited access to all features.',
        [{ text: 'Get Started', onPress: onClose }]
      );
    } catch (error) {
      console.error('Upgrade failed:', error);
      Alert.alert(
        'Upgrade Failed',
        'We couldn\'t process your upgrade. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const getHeaderText = () => {
    switch (source) {
      case 'query_limit':
        return {
          title: 'You\'ve reached your daily limit',
          subtitle: 'Upgrade to Power Strategist for unlimited coaching'
        };
      case 'feature_gate':
        return {
          title: 'Unlock Premium Features',
          subtitle: 'Get access to advanced coaching capabilities'
        };
      case 'onboarding':
        return {
          title: 'Maximize Your Potential',
          subtitle: 'Get the most out of your coaching experience'
        };
      default:
        return {
          title: 'Unlock Power Strategist',
          subtitle: 'Take your relationship coaching to the next level'
        };
    }
  };

  const valueProps = [
    {
      icon: 'infinite' as const,
      title: 'Unlimited Queries',
      description: 'Ask as many questions as you need without daily limits'
    },
    {
      icon: 'mic' as const,
      title: 'Voice Input',
      description: 'Speak your questions naturally with voice recognition'
    },
    {
      icon: 'analytics' as const,
      title: 'Deep Context Analysis',
      description: 'Advanced AI understanding of your relationship dynamics'
    },
    {
      icon: 'person' as const,
      title: 'Full Personalization',
      description: 'Tailored advice based on your unique situation and history'
    },
    {
      icon: 'shield-checkmark' as const,
      title: 'Priority Support',
      description: 'Get faster responses and premium customer support'
    }
  ];

  const headerText = getHeaderText();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{headerText.title}</Text>
            <Text style={styles.subtitle}>{headerText.subtitle}</Text>

            {trialStatus.daysRemaining && (
              <View style={styles.trialBanner}>
                <Ionicons name="time" size={16} color="#FF6B35" />
                <Text style={styles.trialText}>
                  {trialStatus.daysRemaining} days left in your trial
                </Text>
              </View>
            )}

            <View style={styles.valuePropsContainer}>
              {valueProps.map((prop, index) => (
                <View key={index} style={styles.valueProp}>
                  <View style={styles.iconContainer}>
                    <Ionicons name={prop.icon} size={24} color="#023047" />
                  </View>
                  <View style={styles.propContent}>
                    <Text style={styles.propTitle}>{prop.title}</Text>
                    <Text style={styles.propDescription}>{prop.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.pricing}>
              <Text style={styles.price}>$30/month</Text>
              <Text style={styles.priceNote}>Cancel anytime</Text>
            </View>

            {trialStatus.isEligible && !trialStatus.daysRemaining && (
              <TouchableOpacity 
                style={[styles.trialButton, loading && styles.buttonDisabled]} 
                onPress={handleStartTrial}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.trialButtonText}>Start 3-Day Free Trial</Text>
                    <Text style={styles.trialButtonSubtext}>Then $30/month</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[
                styles.upgradeButton, 
                trialStatus.isEligible && !trialStatus.daysRemaining && styles.upgradeButtonSecondary,
                loading && styles.buttonDisabled
              ]} 
              onPress={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={trialStatus.isEligible ? "#023047" : "#fff"} />
              ) : (
                <Text style={[
                  styles.upgradeButtonText,
                  trialStatus.isEligible && !trialStatus.daysRemaining && styles.upgradeButtonTextSecondary
                ]}>
                  {trialStatus.daysRemaining ? 'Continue Subscription' : 'Subscribe for $30/month'}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              {trialStatus.isEligible && !trialStatus.daysRemaining
                ? 'Free trial for 3 days, then $30/month. Cancel anytime in your account settings.'
                : 'Billed monthly. Cancel anytime in your account settings.'
              }
            </Text>

            {trialStatus.isEligible && (
              <View style={styles.features}>
                <Text style={styles.featuresTitle}>✨ What you get with your trial:</Text>
                <Text style={styles.featureItem}>• Unlimited coaching sessions</Text>
                <Text style={styles.featureItem}>• Voice input capabilities</Text>
                <Text style={styles.featureItem}>• Advanced AI analysis</Text>
                <Text style={styles.featureItem}>• Priority support</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  trialText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  valuePropsContainer: {
    marginBottom: 24,
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#02304722',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  propContent: {
    flex: 1,
  },
  propTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  pricing: {
    alignItems: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#023047',
    marginBottom: 4,
  },
  priceNote: {
    fontSize: 14,
    color: '#666',
  },
  trialButton: {
    backgroundColor: '#023047',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  trialButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  trialButtonSubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
  upgradeButton: {
    backgroundColor: '#023047',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradeButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#023047',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  upgradeButtonTextSecondary: {
    color: '#023047',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  features: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
}); 