import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';

export const AccountScreen: React.FC = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, tier, logout, dailyQueryCount } = useAuth();

  const getTierInfo = () => {
    switch (tier) {
      case 'guest':
        return {
          name: 'Guest',
          badge: 'FREE',
          color: theme.textSecondary,
          features: [
            '3 daily AI conversations',
            'Basic relationship coaching',
            'General advice and tips'
          ]
        };
      case 'essential':
        return {
          name: 'Essential Coach',
          badge: 'ESSENTIAL',
          color: theme.accent,
          features: [
            '3 daily AI conversations',
            'Personalized coaching',
            'Relationship strategies',
            'Priority support'
          ]
        };
      case 'power':
        return {
          name: 'Power Strategist',
          badge: 'POWER',
          color: theme.colors.saffron,
          features: [
            'Unlimited AI conversations',
            'Advanced coaching techniques',
            'Voice input support',
            'Premium relationship content',
            'Priority support'
          ]
        };
      default:
        return {
          name: 'Guest',
          badge: 'FREE',
          color: theme.textSecondary,
          features: ['3 daily conversations']
        };
    }
  };

  const tierInfo = getTierInfo();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Container variant="screen">
      <ScrollView>
        {/* User Info */}
        <Container variant="card" margin="medium" padding="large">
          <View style={styles.userSection}>
            <Text style={[styles.userName, { color: theme.textPrimary }]}>
              {user?.email || 'Guest User'}
            </Text>
            <View style={[styles.tierBadge, { backgroundColor: tierInfo.color }]}>
              <Text style={[styles.tierBadgeText, { color: theme.colors.eerieBlack }]}>
                {tierInfo.badge}
              </Text>
            </View>
          </View>
        </Container>

        {/* Current Plan */}
        <Container variant="card" margin="medium" padding="large">
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Current Plan: {tierInfo.name}
          </Text>
          
          {tier !== 'power' && (
            <View style={styles.usageContainer}>
              <Text style={[styles.usageText, { color: theme.textSecondary }]}>
                Daily Usage: {dailyQueryCount}/3 queries used
              </Text>
            </View>
          )}

          <View style={styles.featuresContainer}>
            <Text style={[styles.featuresTitle, { color: theme.textPrimary }]}>
              Plan Features:
            </Text>
            {tierInfo.features.map((feature, index) => (
              <Text key={index} style={[styles.featureItem, { color: theme.textSecondary }]}>
                • {feature}
              </Text>
            ))}
          </View>

          {tier !== 'power' && (
            <Button
              title="Upgrade to Power Strategist"
              onPress={() => {/* TODO: Handle upgrade */}}
              style={styles.upgradeButton}
            />
          )}

          {tier === 'power' && (
            <Button
              title="Manage Subscription"
              variant="outline"
              onPress={() => {/* TODO: Handle subscription management */}}
              style={styles.manageButton}
            />
          )}
        </Container>

        {/* Theme Settings */}
        <Container variant="card" margin="medium" padding="large">
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            Preferences
          </Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>
              Dark Mode
            </Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor={isDark ? theme.colors.saffron : theme.surface}
            />
          </View>
        </Container>

        {/* Account Actions */}
        {user && (
          <Container variant="card" margin="medium" padding="large">
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Account
            </Text>
            
            <Button
              title="Sign Out"
              variant="outline"
              onPress={handleLogout}
              style={styles.signOutButton}
            />
          </Container>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  userSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  usageContainer: {
    marginBottom: 16,
  },
  usageText: {
    fontSize: 14,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 4,
    paddingLeft: 8,
  },
  upgradeButton: {
    marginTop: 8,
  },
  manageButton: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
  },
  signOutButton: {
    marginTop: 8,
  },
  bottomSpacing: {
    height: 32,
  },
}); 