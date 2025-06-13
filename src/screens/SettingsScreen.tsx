import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { Button } from '../components/Button';
import { Drawer } from '../components/Drawer';

interface SettingsScreenProps {
  isVisible: boolean;
  onClose: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ isVisible, onClose }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [displayName, setDisplayName] = useState('John Doe'); // TODO: Get from user context
  const [email] = useState('john.doe@example.com'); // TODO: Get from auth context
  const [hasChanges, setHasChanges] = useState(false);

  const handleDisplayNameChange = (text: string) => {
    setDisplayName(text);
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Save changes to backend
    console.log('Saving changes:', { displayName });
    setHasChanges(false);
    Alert.alert('Success', 'Settings saved successfully');
  };

  const handleDiscard = () => {
    // TODO: Reset to original values
    setDisplayName('John Doe');
    setHasChanges(false);
  };

  const handleUpgrade = () => {
    // TODO: Navigate to subscription screen
    console.log('Navigate to subscription');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => {
            // TODO: Implement sign out
            console.log('Sign out');
            onClose();
          }
        },
      ]
    );
  };

  return (
    <Drawer isVisible={isVisible} onClose={onClose} title="Settings">
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
            Profile
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.semanticColors.textSecondary }]}>
              Display Name
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.semanticColors.surface,
                  borderColor: theme.semanticColors.border,
                  color: theme.semanticColors.textPrimary,
                },
              ]}
              value={displayName}
              onChangeText={handleDisplayNameChange}
              placeholder="Enter your display name"
              placeholderTextColor={theme.semanticColors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.semanticColors.textSecondary }]}>
              Email
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.disabledInput,
                {
                  backgroundColor: theme.semanticColors.border + '20',
                  borderColor: theme.semanticColors.border,
                  color: theme.semanticColors.textSecondary,
                },
              ]}
              value={email}
              editable={false}
              placeholder="Email address"
              placeholderTextColor={theme.semanticColors.textSecondary}
            />
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
            Subscription
          </Text>
          
          <View style={styles.tierContainer}>
            <View style={styles.tierInfo}>
              <Text style={[styles.tierTitle, { color: theme.semanticColors.textPrimary }]}>
                Free Plan
              </Text>
              <Text style={[styles.tierDescription, { color: theme.semanticColors.textSecondary }]}>
                3 conversations per day
              </Text>
            </View>
            <Button
              title="Upgrade"
              variant="cta"
              size="small"
              onPress={handleUpgrade}
            />
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
            Preferences
          </Text>
          
          <TouchableOpacity style={styles.preferenceItem} onPress={toggleTheme}>
            <Text style={[styles.preferenceLabel, { color: theme.semanticColors.textPrimary }]}>
              Dark Mode
            </Text>
            <View style={[
              styles.toggle,
              {
                backgroundColor: isDark ? theme.semanticColors.primary : theme.semanticColors.border,
              },
            ]}>
              <View style={[
                styles.toggleThumb,
                {
                  backgroundColor: theme.semanticColors.surface,
                  transform: [{ translateX: isDark ? 20 : 2 }],
                },
              ]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Personalization Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
            Personalization
          </Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={[styles.menuItemText, { color: theme.semanticColors.textPrimary }]}>
              Edit Profile & Preferences
            </Text>
            <Text style={[styles.menuItemArrow, { color: theme.semanticColors.textSecondary }]}>
              →
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={[styles.menuItemText, { color: theme.semanticColors.textPrimary }]}>
              Communication Style
            </Text>
            <Text style={[styles.menuItemArrow, { color: theme.semanticColors.textSecondary }]}>
              →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          {hasChanges && (
            <View style={styles.actionsContainer}>
              <Button
                title="Discard"
                variant="outline"
                onPress={handleDiscard}
                style={styles.actionButton}
              />
              <Button
                title="Save"
                variant="cta"
                onPress={handleSave}
                style={[styles.actionButton, { flex: 1, marginLeft: 12 }]}
              />
            </View>
          )}
          
          <Button
            title="Sign Out"
            variant="outline"
            onPress={handleSignOut}
            style={[styles.signOutButton, { borderColor: '#FF4444' }]}
          />
        </View>
      </ScrollView>
    </Drawer>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  disabledInput: {
    opacity: 0.6,
  },
  tierContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tierInfo: {
    flex: 1,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 14,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuItemArrow: {
    fontSize: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  actionButton: {
    minWidth: 100,
  },
  signOutButton: {
    marginTop: 20,
  },
}); 