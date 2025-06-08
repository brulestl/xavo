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
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { ListItem } from '../components/ListItem';
import { Ionicons } from '@expo/vector-icons';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, tier, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => {
            logout();
            navigation.navigate('Welcome' as never);
          }
        },
      ]
    );
  };

  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      `Current tier: ${tier}\n\nSubscription management coming soon!`,
      [{ text: 'OK' }]
    );
  };

  const handlePersonalization = () => {
    Alert.alert(
      'Personalization',
      'Personalization settings coming soon!',
      [{ text: 'OK' }]
    );
  };

  const getTierDisplayName = () => {
    switch (tier) {
      case 'guest': return 'Guest Mode';
      case 'essential': return 'Essential Coach';
      case 'power': return 'Power Strategist';
      default: return 'Guest Mode';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.screenBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          Settings
        </Text>
        
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Info Section */}
        <View style={styles.section}>
          <ListItem
            title={user?.email || 'Guest User'}
            subtitle="Email"
            leftIcon="person-outline"
            rightIcon={undefined}
          />
          
          <ListItem
            title="Phone Number"
            subtitle="Not set"
            leftIcon="call-outline"
            onPress={() => Alert.alert('Phone', 'Phone number management coming soon!')}
          />
          
          <ListItem
            title={getTierDisplayName()}
            subtitle="Current subscription"
            leftIcon="star-outline"
            onPress={handleManageSubscription}
          />
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <ListItem
            title="Manage Subscription"
            leftIcon="card-outline"
            onPress={handleManageSubscription}
          />
          
          <ListItem
            title="Personalization"
            leftIcon="options-outline"
            onPress={handlePersonalization}
          />
          
          <ListItem
            title={`Theme: ${isDark ? 'Dark' : 'Light'}`}
            leftIcon="moon-outline"
            onPress={toggleTheme}
          />
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <ListItem
            title="Sign Out"
            leftIcon="log-out-outline"
            rightIcon={undefined}
            onPress={handleLogout}
          />
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
  section: {
    marginTop: 24,
  },
}); 