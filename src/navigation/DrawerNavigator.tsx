import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, TextInput, Alert, SafeAreaView, ScrollView } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { OnboardingEditScreen } from '../screens/OnboardingEditScreen';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';
import { SearchBar } from '../components/SearchBar';
import { TierBadge } from '../components/ui/TierBadge';
import { ListItem } from '../components/ListItem';

const { width: screenWidth } = Dimensions.get('window');

const Drawer = createDrawerNavigator();

// Mock chat history data (replace with real data from context/API)
const mockChatHistory = [
  {
    id: '1',
    title: 'Stakeholder Analysis Session',
    date: 'Today, 2:30 PM',
    preview: 'Discussed strategies for engaging key stakeholders...',
  },
  {
    id: '2',
    title: 'Email Draft Review',
    date: 'Yesterday, 4:15 PM',
    preview: 'Reviewed and refined the quarterly report email...',
  },
  {
    id: '3',
    title: 'Policy Summary',
    date: 'Dec 5, 10:20 AM',
    preview: 'Summarized the new remote work policy changes...',
  },
];

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const { theme } = useTheme();
  const { displayName, user, tier, updateDisplayName, logout } = useAuth();
  
  const [editingName, setEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);
  const [saving, setSaving] = useState(false);

  const handleNewSession = () => {
    props.navigation.navigate('Chat');
    props.navigation.closeDrawer();
  };

  const handleChatPress = (chatId: string, title: string) => {
    // TODO: Navigate to specific chat or load chat history
    console.log('Opening chat:', chatId, title);
    props.navigation.navigate('Chat');
    props.navigation.closeDrawer();
  };

  const handleNavigateToOnboardingEdit = () => {
    props.navigation.navigate('OnboardingEdit');
    props.navigation.closeDrawer();
  };

  const handleSaveDisplayName = async () => {
    if (!tempDisplayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setSaving(true);
    const { error } = await updateDisplayName(tempDisplayName.trim());
    setSaving(false);
    
    if (error) {
      Alert.alert('Error', 'Failed to update display name');
    } else {
      setEditingName(false);
    }
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
          onPress: logout,
        },
      ]
    );
  };

  // Generate initials from display name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (
    <SafeAreaView style={[styles.drawerContainer, { backgroundColor: theme.semanticColors.background }]}>
      {/* Main Container - Wraps both account and conversations */}
      <View style={styles.mainContainer}>
        {/* User Account Section - TOP - 15% of main container */}
        <View style={[styles.userAccountSection, { borderBottomColor: theme.semanticColors.border }]}>
          {/* Account Icon - Triggers Settings */}
          <TouchableOpacity 
            style={[styles.accountIconButton, { backgroundColor: theme.semanticColors.cardBackground }]}
            onPress={handleNavigateToOnboardingEdit}
          >
            <View style={[styles.accountAvatar, { backgroundColor: theme.colors.xavoBlue }]}>
              <Text style={[styles.accountAvatarText, { color: theme.colors.pureWhite }]}>
                {getInitials(displayName)}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, { color: theme.semanticColors.textPrimary }]}>
                {displayName}
              </Text>
              <View style={styles.accountTierRow}>
                <TierBadge tier={tier} size="small" />
                <Ionicons
                  name="settings-outline"
                  size={16}
                  color={theme.semanticColors.textSecondary}
                  style={styles.settingsIcon}
                />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Main Conversations Area - BOTTOM - 85% of main container */}
        <View style={styles.conversationsArea}>
          <ScrollView style={styles.scrollableContent} contentContainerStyle={styles.scrollContentContainer}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <SearchBar placeholder="Search chats..." />
            </View>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                Your past conversations
              </Text>
            </View>

            {/* Chat History List */}
            <View style={styles.historyList}>
              {mockChatHistory.length > 0 ? (
                mockChatHistory.map((chat) => (
                  <ListItem
                    key={chat.id}
                    title={chat.title}
                    subtitle={`${chat.date} • ${chat.preview}`}
                    leftIcon="chatbubbles-outline"
                    onPress={() => handleChatPress(chat.id, chat.title)}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons 
                    name="chatbubbles-outline" 
                    size={48} 
                    color={theme.semanticColors.textSecondary} 
                  />
                  <Text style={[styles.emptyText, { color: theme.semanticColors.textSecondary }]}>
                    No conversations yet
                  </Text>
                </View>
              )}
            </View>

            {/* New Session Button */}
            <View style={styles.newSessionContainer}>
              <TouchableOpacity 
                style={[styles.newSessionButton, { backgroundColor: theme.colors.xavoBlue }]} 
                onPress={handleNewSession}
              >
                <Ionicons name="add" size={20} color={theme.colors.pureWhite} />
                <Text style={[styles.newSessionText, { color: theme.colors.pureWhite }]}>
                  New Session
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

export const DrawerNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: '85%', // 85% screen width as specified for history drawer
          backgroundColor: theme.semanticColors.background,
        },
        drawerType: 'slide',
        overlayColor: 'rgba(0,0,0,0.5)',
        sceneContainerStyle: {
          backgroundColor: theme.semanticColors.background,
        },
      }}
    >
      <Drawer.Screen name="Chat" component={ChatScreen} />
      <Drawer.Screen name="History" component={HistoryScreen} />
      <Drawer.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Drawer.Screen name="OnboardingEdit" component={OnboardingEditScreen} />
      <Drawer.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Drawer.Screen 
        name="Account" 
        component={AccountScreen}
        options={{
          title: 'Account',
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
  },
  scrollableContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  // New Layout Styles
  conversationsArea: {
    flex: 0.85, // 85% of height
  },
  userAccountSection: {
    flex: 0.15, // 15% of height
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  accountIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountAvatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  accountInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    marginLeft: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyList: {
    paddingHorizontal: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  newSessionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  newSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  newSessionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Account Profile Styles
  accountProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 4,
  },
  tierContainer: {
    alignSelf: 'flex-start',
  },
  editContainer: {
    marginBottom: 4,
  },
  textInput: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 4,
  },
  savingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Personalization Row
  personalizationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  personalizationText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  // Sign Out Button
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30', // Red color for sign out
  },
  menuSection: {
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14, // Tightened spacing
    borderRadius: 8,
    marginBottom: 4,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500', // Improved font weight
    marginLeft: 12,
  },
  bottomSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  // Legacy styles (keeping for compatibility)
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 16,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  tierText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  queriesText: {
    fontSize: 12,
    marginTop: 4,
  },
  guestInfo: {
    marginTop: 8,
  },
  guestText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  navigationSection: {
    flex: 1,
  },
  separator: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
  },
  headerLeft: {
    marginLeft: 16,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
}); 