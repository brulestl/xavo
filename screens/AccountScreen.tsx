import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function AccountScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { tier, email, logout, subscribePower } = useAuth();

  const getTierBadge = () => {
    switch (tier) {
      case 'essential':
        return {
          title: 'Essential Coach',
          color: '#007AFF',
          backgroundColor: '#007AFF22',
        };
      case 'power':
        return {
          title: 'Power Strategist',
          color: '#023047',
          backgroundColor: '#02304722',
        };
      default:
        return {
          title: 'Guest',
          color: '#666',
          backgroundColor: '#66666622',
        };
    }
  };

  const handleUpgrade = async () => {
    try {
      await subscribePower();
      Alert.alert('Success!', 'Welcome to Power Strategist tier! You now have unlimited queries and voice input.');
    } catch (error) {
      Alert.alert('Error', 'Failed to upgrade. Please try again.');
    }
  };

  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      'In a real app, this would open subscription management.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View Details', onPress: () => {} },
      ]
    );
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your Power Strategist subscription? You will lose access to unlimited queries and voice input.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        { text: 'Cancel Subscription', style: 'destructive', onPress: () => {
          // In a real app, this would cancel the subscription
          Alert.alert('Subscription Cancelled', 'Your subscription has been cancelled.');
        }},
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const badge = getTierBadge();

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* User Info Section */}
        <View style={styles.section}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#666" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.email}>{email || 'Guest User'}</Text>
              <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>
                  {badge.title}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tier Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Plan</Text>
          <View style={styles.benefitsList}>
            {tier === 'essential' && (
              <>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                  <Text style={styles.benefitText}>3 daily queries</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                  <Text style={styles.benefitText}>Essential coaching</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                  <Text style={[styles.benefitText, styles.disabledText]}>Voice input</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                  <Text style={[styles.benefitText, styles.disabledText]}>Deep personalization</Text>
                </View>
              </>
            )}
            {tier === 'power' && (
              <>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#023047" />
                  <Text style={styles.benefitText}>Unlimited queries</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#023047" />
                  <Text style={styles.benefitText}>Voice input enabled</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#023047" />
                  <Text style={styles.benefitText}>Deep context analysis</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#023047" />
                  <Text style={styles.benefitText}>Full personalization</Text>
                </View>
              </>
            )}
            {tier === 'guest' && (
              <>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#666" />
                  <Text style={styles.benefitText}>3 daily queries</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={20} color="#666" />
                  <Text style={styles.benefitText}>Basic coaching</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                  <Text style={[styles.benefitText, styles.disabledText]}>Voice input</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Upgrade/Manage Section */}
        {tier === 'essential' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
              <View style={styles.upgradeContent}>
                <View>
                  <Text style={styles.upgradeTitle}>Upgrade to Power Strategist</Text>
                  <Text style={styles.upgradePrice}>$30/month</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {tier === 'power' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
              <Ionicons name="arrow-forward" size={16} color="#023047" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSubscription}>
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign Out */}
        {tier !== 'guest' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  benefitsList: {
    gap: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#333',
  },
  disabledText: {
    color: '#999',
  },
  upgradeButton: {
    backgroundColor: '#023047',
    borderRadius: 12,
    padding: 20,
  },
  upgradeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  upgradePrice: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  manageButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#023047',
    borderRadius: 8,
    marginBottom: 12,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#023047',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#ff3b30',
  },
  signOutButton: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff3b30',
    borderRadius: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ff3b30',
  },
});